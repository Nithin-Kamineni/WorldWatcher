"""Bugs.txt #2 (spell images, remaining coverage): after the local 5etools-img pass
(assets.link_spell_asset, run automatically during `cli.py`) and the dedupe/backfill pass
(dedupe_spells.py) have run, some spells still have no image_asset_id because no matching
file exists in the local 5etools-img mirror. This script fills as many of those as it can
from the Baldur's Gate 3 wiki's spell list, per explicit user instruction - BG3 reuses core
D&D 5e spell names heavily, and its spell icon art is being used as stand-in imagery here
(not "official" tabletop book art).

Deliberately NOT wired into cli.py's `run()` - unlike every other stage there, this one
makes live HTTP requests to a third-party site, so it's a separate, manually-invoked script
(`python -m Database.Maintainance.importer.scrape_spell_images` from the Database/Maintainance
directory, or via this module's `main()`).

Respectful of the source: robots.txt for baldursgate3.wiki.fextralife.com explicitly allows
/Spells for a normal user-agent; this does exactly one GET of that single listing page (the
whole spell table is server-rendered into one page, confirmed by inspecting the raw HTML -
no pagination/AJAX to chase), a real descriptive User-Agent, a small delay between each image
download, and an on-disk cache (Database/external-data/scraped-img/spells/) so re-running
this script never re-downloads an image it already has.
"""
import argparse
import mimetypes
import os
import re
import shutil
import sys
import time
import urllib.request

from . import db as db_mod
from .config import Config
from .hashing import file_sha256
from .report import Report

SPELLS_PAGE_URL = "https://baldursgate3.wiki.fextralife.com/Spells"
WIKI_BASE = "https://baldursgate3.wiki.fextralife.com"
USER_AGENT = "Mozilla/5.0 (compatible; WorldWatcherSpellImageBot/1.0; local personal-use dev tool)"
DOWNLOAD_DELAY_SECONDS = 0.4

# Matches each spell row's "icon cell": <h5><a class="wiki_link" title="Baldurs Gate 3 <Name>"
# href="<href>"><img ... src="<thumbnail>"> - confirmed against a live fetch of the page.
ROW_RE = re.compile(
    r'<h5><a class="wiki_link" title="Baldurs Gate 3 ([^"]+)" href="([^"]+)"[^>]*><img[^>]*src="([^"]+)"'
)


def _norm(name: str) -> str:
    name = re.sub(r"\s*\(spell\)\s*$", "", name or "", flags=re.I)
    return name.strip().lower()


def fetch_spell_image_index() -> dict:
    """One GET of the spells listing page -> {normalized_name: absolute_image_url}. First
    occurrence wins for names listed more than once (e.g. multi-class variant rows)."""
    req = urllib.request.Request(SPELLS_PAGE_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        html = resp.read().decode("utf-8", "replace")

    index = {}
    for name, _href, src in ROW_RE.findall(html):
        key = _norm(name)
        if key and key not in index:
            index[key] = WIKI_BASE + src if src.startswith("/") else src
    return index


def _download(url: str, dest_path: str):
    if os.path.exists(dest_path):
        return False
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "wb") as f:
        f.write(data)
    time.sleep(DOWNLOAD_DELAY_SECONDS)
    return True


def _upsert_scraped_asset(cur, asset_output_dir: str, *, cache_path: str, spell_id) -> str:
    """Same hash-dedupe-by-sha256 + copy-into-storage shape as
    importer.assets.upsert_asset_from_file, but for a file downloaded from the web rather
    than matched out of the local 5etools-img mirror."""
    sha = file_sha256(cache_path)
    cur.execute("SELECT id FROM assets WHERE sha256 = %s", (sha,))
    row = cur.fetchone()
    if row:
        asset_id = row[0]
    else:
        filename = os.path.basename(cache_path)
        storage_rel = f"spells/fextralife/{filename}"
        dest_path = os.path.join(asset_output_dir, storage_rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        if not os.path.exists(dest_path):
            shutil.copyfile(cache_path, dest_path)
        values = {
            "filename": filename,
            "storage_path": storage_rel,
            "asset_type": "spell_image",
            "mime_type": mimetypes.guess_type(cache_path)[0],
            "width": None,
            "height": None,
            "file_size": os.path.getsize(cache_path),
            "sha256": sha,
            "source": "fextralife-wiki",
            "source_path": SPELLS_PAGE_URL,
            "raw_data": None,
        }
        asset_id, _ = db_mod.upsert(cur, "assets", ["sha256"], values)

    cur.execute("UPDATE spells SET image_asset_id = %s WHERE id = %s", (asset_id, spell_id))
    return asset_id


def run(cur, cache_dir: str, asset_output_dir: str, report: Report) -> tuple[int, int]:
    """Returns (matched, downloaded)."""
    index = fetch_spell_image_index()

    cur.execute("SELECT id, name FROM spells WHERE image_asset_id IS NULL")
    candidates = cur.fetchall()

    matched = 0
    downloaded = 0
    for spell_id, name in candidates:
        url = index.get(_norm(name))
        if not url:
            continue

        ext = os.path.splitext(url.split("?")[0])[1] or ".png"
        cache_filename = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") + ext
        cache_path = os.path.join(cache_dir, cache_filename)

        try:
            was_new = _download(url, cache_path)
            if was_new:
                downloaded += 1
                report.record_asset("spell_image_scraped_downloaded")
            _upsert_scraped_asset(cur, asset_output_dir, cache_path=cache_path, spell_id=spell_id)
            matched += 1
            report.record_asset("spell_image_scraped_matched")
        except Exception as e:
            report.record("spell_image_scrape", "fextralife", name, "error", str(e))

    return matched, downloaded


def main(argv=None):
    p = argparse.ArgumentParser(description="Backfill remaining spell images from the BG3 wiki spell list")
    p.add_argument("--cache-dir", default=None)
    p.add_argument("--asset-output", default=None)
    args = p.parse_args(argv)

    cfg = Config()
    if args.asset_output:
        cfg.asset_output = args.asset_output
    cache_dir = args.cache_dir or os.path.normpath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "external-data", "scraped-img", "spells")
    )

    report = Report(cfg.log_dir)
    conn = db_mod.connect(cfg)
    cur = conn.cursor()
    try:
        matched, downloaded = run(cur, cache_dir, cfg.asset_output, report)
        conn.commit()
        print(f"Matched {matched} spells to a BG3 wiki image ({downloaded} newly downloaded).")
    finally:
        summary = report.finish()
        print("\n".join(summary))
        cur.close()
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
