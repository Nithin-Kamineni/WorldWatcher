"""Canonical JSON + sha256 helpers shared by raw_ingest and assets."""
import hashlib
import json


def canonicalize(obj):
    """Recursively sort dict keys so re-formatting upstream JSON never
    causes a spurious content-hash change."""
    if isinstance(obj, dict):
        return {k: canonicalize(obj[k]) for k in sorted(obj.keys())}
    if isinstance(obj, list):
        return [canonicalize(v) for v in obj]
    return obj


def content_hash(obj) -> str:
    canonical = canonicalize(obj)
    encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def file_sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def slugify(name: str) -> str:
    """Matches the app's client-side slugify(): lowercase, non-alphanumeric
    runs collapse to a single '-', leading/trailing '-' trimmed."""
    out = []
    prev_dash = False
    for ch in name.lower():
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        else:
            if not prev_dash:
                out.append("-")
                prev_dash = True
    slug = "".join(out).strip("-")
    return slug or "unnamed"
