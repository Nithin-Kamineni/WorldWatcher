"""Traces sight-blocking geometry out of a map's background image.

Runs server-side rather than in the browser for two reasons: the image file
is already sitting on this machine's disk (assets are stored as files, see
api/routers/assets.py), and this is a one-shot job per map rather than a
per-frame one, so there is nothing to gain from the client's GPU and a lot to
lose from shipping opencv.js - an ~8MB wasm payload - into MapPage's chunk.

What comes back is explicitly a FIRST DRAFT. Auto-tracing walls off an
arbitrary battlemap is not a solved problem: it works well on line-art
dungeon exports, where a wall is literally a dark stroke on a light floor,
and much less well on painted outdoor scenes, where "wall" is a judgement
about which grey shape is a boulder and which is flat ground. The UI appends
the result to whatever walls already exist and expects the DM to correct it.
"""
from __future__ import annotations

from typing import Literal

import numpy as np

WallDetectMode = Literal["painted", "lineart"]

#: Long edge the image is scaled down to before processing. Detection quality
#: barely changes above this and the contour pass gets much slower.
MAX_WORKING_EDGE = 1400

#: Hard cap on returned polylines. A noisy painted map can produce tens of
#: thousands of contours, and every one of them is a segment the browser's
#: line-of-sight sweep would have to test against on every token move.
MAX_POLYLINES = 200

#: Contours shorter than this fraction of (width + height) are texture, not
#: architecture: gravel, foliage speckle, the artist's signature.
MIN_PERIMETER_FRACTION = 0.08

#: approxPolyDP tolerance, as a fraction of each contour's own perimeter.
#: Deliberately small. Volume is controlled by dropping whole short contours
#: above, NOT by simplifying harder - a heavily simplified contour straightens
#: into chords that cut across open floor, which puts a sight blocker where
#: the map has none. Tested at 0.012 and it drew diagonals across bare ground.
SIMPLIFY_FRACTION = 0.005


class WallDetectUnavailable(RuntimeError):
    """OpenCV is not installed in this environment."""


def _load_cv2():
    try:
        import cv2  # noqa: PLC0415 - optional dependency, imported lazily
    except ImportError as exc:  # pragma: no cover - depends on the install
        raise WallDetectUnavailable(
            "OpenCV is not installed. Run: Server/.venv/Scripts/python.exe -m pip install opencv-python-headless"
        ) from exc
    return cv2


def _binary_mask(cv2, gray: np.ndarray, mode: str, sensitivity: int) -> np.ndarray:
    """Reduces the image to a white-on-black mask of candidate wall pixels.

    The two modes exist because the two common kinds of battlemap want
    genuinely different treatment, and using the wrong one is the single
    biggest cause of a useless result.
    """
    if mode == "lineart":
        # Dark ink on a light floor: the wall IS a colour, so threshold it.
        # Higher sensitivity accepts lighter greys as wall.
        cutoff = int(np.interp(sensitivity, [5, 95], [55, 165]))
        _, mask = cv2.threshold(gray, cutoff, 255, cv2.THRESH_BINARY_INV)
        # Drop speckle from compression artefacts and grid lines.
        return cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    # Painted/rendered map: nothing about the colour says "wall", so go after
    # edges instead. The bilateral filter flattens brush texture and gravel
    # noise while leaving the rock/ground boundary intact, which plain
    # Gaussian blur does not.
    smoothed = cv2.bilateralFilter(gray, 9, 75, 75)
    high = int(np.interp(sensitivity, [5, 95], [210, 45]))
    edges = cv2.Canny(smoothed, max(5, high // 2), high)
    # Canny leaves an outline broken wherever a shadow softens the boundary;
    # closing bridges those gaps so a boulder traces as one contour rather
    # than as a dotted line that light leaks straight through.
    return cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=2)


def detect_walls(
    image_path: str,
    mode: WallDetectMode = "painted",
    sensitivity: int = 50,
) -> tuple[int, int, list[list[float]]]:
    """Returns (image_width, image_height, polylines) in the image's own
    pixel space, where each polyline is a flat [x, y, x, y, ...] list."""
    cv2 = _load_cv2()

    image = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    full_h, full_w = image.shape[:2]

    # Work at a bounded size, then scale the traced coordinates back up so the
    # caller always gets full-resolution image space.
    long_edge = max(full_w, full_h)
    downscale = min(1.0, MAX_WORKING_EDGE / long_edge)
    if downscale < 1.0:
        work = cv2.resize(image, (int(full_w * downscale), int(full_h * downscale)), interpolation=cv2.INTER_AREA)
    else:
        work = image
    work_h, work_w = work.shape[:2]

    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    mask = _binary_mask(cv2, gray, mode, sensitivity)

    contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    min_perimeter = MIN_PERIMETER_FRACTION * (work_w + work_h)
    scored: list[tuple[float, np.ndarray]] = []
    for contour in contours:
        perimeter = cv2.arcLength(contour, False)
        if perimeter < min_perimeter:
            continue
        scored.append((perimeter, contour))

    # Keep the longest contours: on a map where the cap bites, the long ones
    # are the walls and the short ones are the gravel.
    scored.sort(key=lambda pair: pair[0], reverse=True)

    inv_scale = 1.0 / downscale if downscale else 1.0
    polylines: list[list[float]] = []
    for perimeter, contour in scored[:MAX_POLYLINES]:
        epsilon = max(1.0, SIMPLIFY_FRACTION * perimeter)
        approx = cv2.approxPolyDP(contour, epsilon, False)
        if len(approx) < 2:
            continue
        flat: list[float] = []
        for point in approx.reshape(-1, 2):
            flat.append(round(float(point[0]) * inv_scale, 2))
            flat.append(round(float(point[1]) * inv_scale, 2))
        polylines.append(flat)

    return full_w, full_h, polylines
