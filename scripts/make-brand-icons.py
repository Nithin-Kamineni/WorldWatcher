"""Generates WorldWatcher's brand mark: one geometry definition -> the SVG master and every
raster size, so they can never drift.

The mark is a d20 seen face-on (the canonical hexagon + top-face triangle silhouette, which is
what makes it read as "d20" and not "hexagon") whose top face carries an eye. That is the name:
a die for the game, a watching eye for the Watcher. Two colours, no gradients, no illustration -
it survives 16px, which the previous stock illustration did not.

Detail is dropped below 32px on purpose: at 16px the facet lines and the eye turn to mush, so
those sizes get the silhouette plus a solid top face, which keeps the distinctive shape.
"""
import io
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Client", "public")

INK = (31, 27, 38)        # #1f1b26 - the tile, close to the app's dark paper
AMBER = (224, 167, 95)    # #e0a75f - the brand amber, the dark-mode primary

R_OUTER = 0.40            # hexagon radius, in unit-box terms
R_FACE = 0.185            # top-face triangle radius
R_PUPIL = 0.058
STROKE = 0.042
TILE_RADIUS = 0.22        # rounded-square corner radius


def pt(angle_deg: float, r: float) -> tuple[float, float]:
    a = math.radians(angle_deg)
    return (0.5 + r * math.cos(a), 0.5 - r * math.sin(a))


HEX = [pt(a, R_OUTER) for a in (90, 150, 210, 270, 330, 30)]
FACE = [pt(a, R_FACE) for a in (90, 210, 330)]
# Each top-face corner runs out to the hexagon corner it shares an angle with; the other three
# hexagon corners are the far points of the side faces and stay unconnected. That asymmetry is
# what reads as a die rather than a wheel.
STRUTS = [(FACE[i], pt(a, R_OUTER)) for i, a in enumerate((90, 210, 330))]


def svg() -> str:
    def p(points):
        return " ".join(f"{x * 64:.2f},{y * 64:.2f}" for x, y in points)

    struts = "\n".join(
        f'  <line x1="{a[0] * 64:.2f}" y1="{a[1] * 64:.2f}" x2="{b[0] * 64:.2f}" y2="{b[1] * 64:.2f}"/>'
        for a, b in STRUTS
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="WorldWatcher">
  <title>WorldWatcher</title>
  <rect width="64" height="64" rx="{TILE_RADIUS * 64:.2f}" fill="#1f1b26"/>
  <g fill="none" stroke="#e0a75f" stroke-width="{STROKE * 64:.2f}" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="{p(HEX)}"/>
{struts}
  </g>
  <polygon points="{p(FACE)}" fill="#e0a75f"/>
  <circle cx="32" cy="32" r="{R_PUPIL * 64:.2f}" fill="#1f1b26"/>
</svg>
"""


def render(size: int, detailed: bool) -> Image.Image:
    """Supersampled 8x then downscaled - PIL has no antialiased polygon drawing of its own.

    The small variant is not just "the same drawing, smaller": it grows the die to fill more of
    the tile and thickens the stroke, because a 4%-of-16px hairline renders as a grey smudge.
    That is the whole reason favicons are authored per size rather than left to the browser."""
    ss = 8
    n = size * ss
    grow = 1.0 if detailed else 1.16
    stroke_mul = 1.0 if detailed else 1.9

    hexagon = [pt(a, R_OUTER * grow) for a in (90, 150, 210, 270, 330, 30)]
    face = [pt(a, R_FACE * grow) for a in (90, 210, 330)]

    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = lambda p: (p[0] * n, p[1] * n)

    d.rounded_rectangle([0, 0, n - 1, n - 1], radius=TILE_RADIUS * n, fill=INK)

    width = max(1, int(STROKE * n * stroke_mul))
    d.polygon([s(p) for p in hexagon], outline=AMBER, width=width)
    if detailed:
        for a, b in STRUTS:
            d.line([s(a), s(b)], fill=AMBER, width=width)
    d.polygon([s(p) for p in face], fill=AMBER)
    if detailed:
        r = R_PUPIL * n
        d.ellipse([n / 2 - r, n / 2 - r, n / 2 + r, n / 2 + r], fill=INK)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    io.open(os.path.join(OUT, "app-icon.svg"), "w", encoding="utf-8").write(svg())
    targets = [
        ("app-icon.png", 512, True),
        ("favicon-256.png", 256, True),
        ("apple-touch-icon.png", 180, True),
        ("favicon-48.png", 48, True),
        ("favicon-32.png", 32, True),
        ("favicon-16.png", 16, False),
    ]
    for name, size, detailed in targets:
        render(size, detailed).save(os.path.join(OUT, name))
        print(f"wrote {name} ({size}px, {'detailed' if detailed else 'simplified'})")
    print("wrote app-icon.svg")


if __name__ == "__main__":
    main()
