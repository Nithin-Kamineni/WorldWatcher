"""Stage 4 (table / table_group). Projects 5etools' `data/tables.json` and
`data/generated/gendata-tables.json` (2,300+ named tables spanning NPC
generation, treasure, traps, madness, curses, monster flavor, etc.) into the
System B random-table engine (random_tables/table_columns/table_entries),
which until now only held hand-authored/seeded content.

A `table` object is one roll (or reference) table: `colLabels` (e.g.
["d20", "Trait"]), `rows` (array of [rangeCell, resultCell, ...]), `name`/
`caption`, `source`, `page`. A `table_group` bundles several related
sub-tables under one name (e.g. "Deities of Eberron"); each sub-table is
projected as its own random_tables row.

Whether a table has printed roll ranges (format 'lookup') or is a positional
reference list (format 'reference') is inferred from the first column label.
Reference lists receive a synthetic 1dN and sequential ranges so every
imported option remains rollable even when the source book printed no die.
category_id is a best-effort keyword match against the curated category tree
seeded by seed_random_tables_taxonomy.py, falling back to the catch-all
'sourced-tables' bucket - never dropped, always re-categorizable later.
"""
import re

from .. import db as db_mod
from ..text import flatten_entry, strip_tags

_DIE_LABEL_RE = re.compile(r"^(\d*)d(\d+)$", re.IGNORECASE)
_RANGE_SEP_RE = re.compile(r"[–—-]")

# Ordered (most specific first) - substrings matched against the lowercased
# table name/caption. First match wins; unmatched tables fall back to
# 'sourced-tables'.
CATEGORY_KEYWORDS = [
    ("npc-generation", [
        "npc appearance", "npc talent", "npc mannerism", "npc bond", "npc ideal", "npc flaw",
        "npc alignment", "npc class", "npc feature", "npc interaction", "flaws and secrets",
        "occupation", "monster motivation", "villain's weakness",
    ]),
    ("names", ["name generator", "names", "epithets"]),
    ("monster-flavor", [
        "personality traits", "roleplaying a", "roleplaying an", "beholder", "mind flayer",
        "yuan-ti", "gith", "duergar", "hag", "orc", "gnoll", "kobold",
    ]),
    ("traps", ["trap"]),
    ("environmental-hazards", ["hazard"]),
    ("madness-fear-stress", ["madness"]),
    ("curses", ["curse"]),
    ("wild-magic-mishaps", ["wild magic"]),
    ("magic-items", ["magic item table"]),
    ("individual-treasure", ["individual treasure"]),
    ("treasure-hoards", ["treasure"]),
    ("trinkets-curios", ["trinket"]),
    ("settlements", ["settlement"]),
    ("buildings", ["tavern", "building"]),
]


def _dice_from_label(label):
    """Parses a table's first colLabel ("d20", "1d13", "d%", ...) into
    (die_count, die_sides), or None if it isn't a die notation at all (a
    plain reference table, e.g. "The Sovereign Host")."""
    if not label:
        return None
    label = label.strip()
    if label.lower() == "d%":
        return 1, 100
    m = _DIE_LABEL_RE.match(label)
    if not m:
        return None
    count = int(m.group(1)) if m.group(1) else 1
    return count, int(m.group(2))


def _norm_roll_value(v, die_sides):
    try:
        n = int(v)
    except (TypeError, ValueError):
        return None
    if die_sides == 100 and n == 0:
        return 100
    return n


def _parse_range_text(cell_text: str, die_sides):
    parts = [p.strip() for p in _RANGE_SEP_RE.split((cell_text or "").strip()) if p.strip()]
    if not parts:
        return None, None
    return _norm_roll_value(parts[0], die_sides), _norm_roll_value(parts[-1], die_sides)


def _cell_range(cell, die_sides):
    """Most range cells are plain strings ("01–02"); some are bare ints (a
    single-value row written as `1` rather than `"1"`); a minority are
    5etools' structured {"type":"cell","roll":{"exact"|min+max}} shape (used
    when a row's range cell also carries formatting/width info) - handle all
    three."""
    if isinstance(cell, dict):
        roll = cell.get("roll")
        if isinstance(roll, dict):
            if "exact" in roll:
                v = _norm_roll_value(roll["exact"], die_sides)
                return v, v
            if "min" in roll or "max" in roll:
                return _norm_roll_value(roll.get("min"), die_sides), _norm_roll_value(roll.get("max"), die_sides)
        return _parse_range_text(_cell_text(cell), die_sides)
    if isinstance(cell, (int, float)):
        v = _norm_roll_value(cell, die_sides)
        return v, v
    return _parse_range_text(cell, die_sides)


def _cell_text(cell) -> str:
    """Flattens one table cell to display text. Cells are usually plain
    strings, but 5etools also uses structured shapes: a {"type":"cell",
    "entry"|"roll":...} wrapper, an inline {"type":"table",...}, an
    {"type":"image",...}, or a nested entries/list block (same shape
    flatten_entry already handles for item/creature descriptions)."""
    if cell is None:
        return ""
    if isinstance(cell, str):
        return strip_tags(cell)
    if isinstance(cell, list):
        return " ".join(_cell_text(c) for c in cell if c)
    if isinstance(cell, dict):
        ctype = cell.get("type")
        if ctype == "cell":
            if "entry" in cell:
                return _cell_text(cell["entry"])
            roll = cell.get("roll")
            if isinstance(roll, dict):
                if "exact" in roll:
                    return str(roll["exact"])
                if "min" in roll or "max" in roll:
                    return f"{roll.get('min', '')}-{roll.get('max', '')}"
            return ""
        if ctype == "image":
            return ""
        if ctype == "table":
            return "[table - see raw_data]"
        return flatten_entry(cell)
    return str(cell)


def _category_for(name: str, category_cache: dict):
    lname = (name or "").lower()
    for slug, keywords in CATEGORY_KEYWORDS:
        if any(kw in lname for kw in keywords):
            if slug in category_cache:
                return category_cache[slug]
    return category_cache.get("sourced-tables")


def _row_text(cells) -> str:
    return " ".join(t for t in (_cell_text(c) for c in cells) if t)


def _write_table(cur, name: str, caption: str, source_book: str, col_labels: list, rows: list, category_cache: dict, format_cache: dict):
    dice = _dice_from_label(col_labels[0] if col_labels else None)
    is_lookup = dice is not None
    nonempty_rows = [row for row in (rows or []) if row]
    die_count, die_sides = dice if dice else (1, max(1, len(nonempty_rows)))
    format_id = format_cache["lookup"] if is_lookup else format_cache["reference"]
    category_id = _category_for(name, category_cache)

    description = None
    if caption and caption != name:
        description = strip_tags(caption)

    values = {
        "name": name,
        "description": description,
        "category_id": category_id,
        "format_id": format_id,
        "source_book": source_book,
        "is_system": True,
    }
    table_id, was_insert = db_mod.upsert(
        cur, "random_tables", ["name", "source_book"], values, conflict_where="source_book IS NOT NULL"
    )
    if not was_insert:
        db_mod.delete_where(cur, "table_columns", "table_id", table_id)

    cur.execute(
        "INSERT INTO table_columns (table_id, name, die_count, die_sides, sort_order) VALUES (%s,%s,%s,%s,%s) RETURNING id",
        (table_id, col_labels[1] if len(col_labels) > 1 else "Result", die_count, die_sides, 0),
    )
    column_id = cur.fetchone()[0]

    for i, row in enumerate(nonempty_rows):
        if is_lookup:
            lo, hi = _cell_range(row[0], die_sides)
            text = _row_text(row[1:])
        else:
            lo = hi = i + 1
            text = _row_text(row)
        cur.execute(
            "INSERT INTO table_entries (column_id, min, max, kind, text, sort_order) VALUES (%s,%s,%s,'text',%s,%s)",
            (column_id, lo, hi, text, i),
        )

    return table_id, was_insert


def project_table(cur, obj: dict, category_cache: dict, format_cache: dict):
    name = obj.get("name") or obj.get("caption") or "(unnamed table)"
    return _write_table(
        cur, name, obj.get("caption"), obj.get("source"), obj.get("colLabels") or [], obj.get("rows") or [],
        category_cache, format_cache,
    )


def project_table_group(cur, obj: dict, category_cache: dict, format_cache: dict):
    """Projects every sub-table in a tableGroup as its own random_tables row.
    Returns (first_table_id, results) where results is [(table_id, name, was_insert), ...]
    for reporting - mirrors stage4_creatures' expand_versions handling of one
    raw entity producing several projected rows."""
    group_name = obj.get("name") or "(unnamed group)"
    group_source = obj.get("source")
    results = []
    for sub in obj.get("tables") or []:
        col_labels = sub.get("colLabels") or []
        sub_label = sub.get("name") or sub.get("caption") or (col_labels[1] if len(col_labels) > 1 else "Table")
        name = f"{group_name} — {sub_label}"
        table_id, was_insert = _write_table(
            cur, name, sub.get("caption"), sub.get("source") or group_source, col_labels, sub.get("rows") or [],
            category_cache, format_cache,
        )
        results.append((table_id, name, was_insert))
    first_id = results[0][0] if results else None
    return first_id, results
