"""Stage 1: load book/adventure metadata into `sources`, upsert by
(abbreviation, edition). Everything else in the importer needs this done
first, since almost every projected row has a source_id FK.
"""
import json
import os

from . import db as db_mod

# 5etools book "group" values seen in the wild -> WorldWatcher source_type.
# Anything not listed here falls back to 'supplement' (see get_or_create).
BOOK_GROUP_TO_SOURCE_TYPE = {
    "core": "core",
    "supplement": "supplement",
    "supplement-alt": "supplement",
    "setting": "supplement",
    "setting-alt": "supplement",
    "screen": "supplement",
    "recipe": "supplement",
    "homecraft": "supplement",
    "organized-play": "supplement",
    "other": "supplement",
}

# 2024-revision core books use an 'X' prefix on the classic id (XPHB, XMM,
# XDMG, ...). 5etools doesn't carry an explicit "edition" field at the book
# level, so this prefix is the only reliable signal - anything else is left
# NULL rather than guessed.
EDITION_2024_PREFIX = "X"
EDITION_2024_KNOWN = {"XPHB", "XMM", "XDMG"}


def _load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _upsert_source(cur, values: dict):
    """sources has UNIQUE(abbreviation, edition), which (standard SQL NULL
    semantics) only fires when edition IS NOT NULL. Most imported sources
    have edition = NULL, so those must target the partial unique index
    (abbreviation) WHERE edition IS NULL instead."""
    if values["edition"] is None:
        return db_mod.upsert(cur, "sources", ["abbreviation"], values, conflict_where="edition IS NULL")
    return db_mod.upsert(cur, "sources", ["abbreviation", "edition"], values)


def _edition_for(abbreviation: str):
    if abbreviation in EDITION_2024_KNOWN or (
        abbreviation.startswith(EDITION_2024_PREFIX) and abbreviation[1:] in {"PHB", "MM", "DMG"}
    ):
        return "2024"
    return None


def load_sources_from_books(cur, data_dir: str) -> dict:
    """Upserts every book + adventure into `sources`. Returns a cache dict
    of {abbreviation: source_id} seeded from this pass."""
    cache = {}

    books_path = os.path.join(data_dir, "books.json")
    if os.path.exists(books_path):
        books = _load_json(books_path).get("book", [])
        for b in books:
            abbr = b.get("id") or b.get("source")
            if not abbr:
                continue
            group = b.get("group")
            source_type = BOOK_GROUP_TO_SOURCE_TYPE.get(group, "supplement")
            values = {
                "name": b.get("name") or abbr,
                "abbreviation": abbr,
                "edition": _edition_for(abbr),
                "source_type": source_type,
                "publisher": "Wizards of the Coast" if group in ("core", "supplement") else None,
                "publication_date": b.get("published"),
                "page": None,
                "license": None,
                "description": None,
                "raw_data": json.dumps(b),
            }
            source_id, _ = _upsert_source(cur, values)
            cache[abbr] = source_id

    adventures_path = os.path.join(data_dir, "adventures.json")
    if os.path.exists(adventures_path):
        adventures = _load_json(adventures_path).get("adventure", [])
        for a in adventures:
            abbr = a.get("id") or a.get("source")
            if not abbr:
                continue
            values = {
                "name": a.get("name") or abbr,
                "abbreviation": abbr,
                "edition": _edition_for(abbr),
                "source_type": "adventure",
                "publisher": "Wizards of the Coast",
                "publication_date": a.get("published"),
                "page": None,
                "license": None,
                "description": None,
                "raw_data": json.dumps(a),
            }
            source_id, _ = _upsert_source(cur, values)
            cache[abbr] = source_id

    return cache


def _infer_fallback_source_type(abbreviation: str) -> str:
    upper = abbreviation.upper()
    if upper == "SRD" or upper.startswith("SRD"):
        return "srd"
    if "UA" in upper:
        return "unearthed_arcana"
    return "supplement"


def get_or_create_source(cur, cache: dict, abbreviation: str):
    """Look up a source by abbreviation (edition NULL), creating a bare-bones
    row on the fly for abbreviations not present in books.json/adventures.json
    (e.g. SRD, third-party/UA sources, or anything Stage 1 didn't cover)."""
    if not abbreviation:
        return None
    if abbreviation in cache:
        return cache[abbreviation]

    cur.execute(
        "SELECT id FROM sources WHERE abbreviation = %s AND edition IS NULL",
        (abbreviation,),
    )
    row = cur.fetchone()
    if row:
        cache[abbreviation] = row[0]
        return row[0]

    values = {
        "name": abbreviation,
        "abbreviation": abbreviation,
        "edition": None,
        "source_type": _infer_fallback_source_type(abbreviation),
        "publisher": None,
        "publication_date": None,
        "page": None,
        "license": None,
        "description": None,
        "raw_data": None,
    }
    source_id, _ = _upsert_source(cur, values)
    cache[abbreviation] = source_id
    return source_id
