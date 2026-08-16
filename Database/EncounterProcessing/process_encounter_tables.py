"""Populates the normalized encounter_tables / encounter_table_creatures
tables from encounters.raw_data, for every encounter with
resolution_type = 'random_table'.

Why this exists: encounters.tables/raw_data are 5etools' original JSON blob
(a random-encounter roll table with free-text rows like "{@dice 2d4}
{@creature Pirate|XMM|Pirates}"). Reading that JSON at display time - or
worse, reading raw_data directly - means creature references are just
strings with no foreign key, so the DM panel can never join to a creature's
stat block/token, and "which mob types appear in this encounter" can't be
queried in SQL. This script processes raw_data ONCE per run and writes real
relational rows instead:

  encounter_tables         - one row per {min, max} roll range
  encounter_table_creatures - one row per creature reference within that
                              range, with creature_id resolved by regex-
                              extracting the {@creature ...} substring out
                              of the raw result text and looking it up
                              against the creatures table.

Idempotent: re-running deletes and rebuilds each processed encounter's rows
(ON DELETE CASCADE from encounter_tables), so it's safe to run after a
fresh import or a creatures-table update.

Usage:
    python process_encounter_tables.py [--dry-run]
"""
import argparse
import os
import re
import sys

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Maintainance"))
from importer.text import strip_tags  # noqa: E402

DB_KWARGS = dict(
    host="localhost", port=5432, dbname="WorldWatcher_DB", user="postgres",
    password=os.environ.get("WW_DB_PASSWORD", "1234"), connect_timeout=10,
)

# A {@creature Name|Source|Display} tag - Name is the substring we regex out
# of the raw result text and use to look up creatures.id. Source/Display are
# optional and only used for the human-readable fallback text.
_CREATURE_TAG_RE = re.compile(r"\{@creature ([^}|]+)(?:\|([^}|]*))?(?:\|([^}]*))?\}")

_NUMBER_WORDS = {
    "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
    "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
}

# A {@dice ...} tag counts as a creature's quantity only when it sits
# immediately before the {@creature ...} tag (optionally separated by
# whitespace) - otherwise it's unrelated flavor text earlier in the row.
_ADJACENT_DICE_RE = re.compile(r"(\{@dice ([^}|]+)(?:\|[^}]*)?\})\s*$")
_TRAILING_WORD_RE = re.compile(r"(\w+)\s*\(?\s*$")


def _extract_creature_refs(result_text: str) -> list[dict]:
    """Regex-extracts each {@creature ...} substring from a table row's raw
    result text, paired with whatever quantity (dice formula or fixed
    count) immediately precedes it."""
    refs = []
    for m in _CREATURE_TAG_RE.finditer(result_text):
        name = strip_tags(m.group(1)).strip()
        preceding = result_text[: m.start()]

        quantity_formula = None
        adj = _ADJACENT_DICE_RE.search(preceding)
        if adj:
            quantity_formula = adj.group(2).strip()
        else:
            word_match = _TRAILING_WORD_RE.search(preceding)
            if word_match:
                word = word_match.group(1).lower()
                if word.isdigit():
                    quantity_formula = word
                elif word in _NUMBER_WORDS:
                    quantity_formula = str(_NUMBER_WORDS[word])

        refs.append({"name_raw": name, "quantity_formula": quantity_formula or "1"})
    return refs


def _find_creature_id(cur, name_raw: str, _cache: dict):
    """Looks up creature_id by searching the creatures table for name_raw as
    a substring of creatures.name (case-insensitive), per the regex-extract-
    then-search approach: exact match first, then a whole-word substring
    match (so "cat" doesn't match "Cataclysm Cultist"), preferring official
    (campaign_id IS NULL) monsters and the shortest matching name."""
    key = name_raw.lower()
    if key in _cache:
        return _cache[key]

    cur.execute("SELECT id FROM creatures WHERE lower(name) = %s ORDER BY campaign_id NULLS FIRST LIMIT 1", (key,))
    row = cur.fetchone()
    if not row:
        cur.execute(
            """
            SELECT id FROM creatures
            WHERE name ~* (%s)
            ORDER BY campaign_id NULLS FIRST, length(name) ASC, id
            LIMIT 1
            """,
            (r"\y" + re.escape(name_raw) + r"\y",),
        )
        row = cur.fetchone()
    if not row:
        cur.execute(
            """
            SELECT id FROM creatures
            WHERE name ILIKE %s
            ORDER BY campaign_id NULLS FIRST, length(name) ASC, id
            LIMIT 1
            """,
            (f"%{name_raw}%",),
        )
        row = cur.fetchone()

    creature_id = row[0] if row else None
    _cache[key] = creature_id
    return creature_id


def process_encounter(cur, encounter_id, raw_data: dict, creature_cache: dict) -> dict:
    cur.execute("DELETE FROM encounter_tables WHERE encounter_id = %s", (encounter_id,))

    stats = {"rows": 0, "creature_refs": 0, "matched": 0, "unmatched": 0}
    row_sort_order = 0
    for band in raw_data.get("tables") or []:
        dice_expression = band.get("diceExpression")
        min_level = band.get("minlvl")
        max_level = band.get("maxlvl")

        for table_row in band.get("table") or []:
            result = table_row.get("result") or ""
            cur.execute(
                """
                INSERT INTO encounter_tables
                    (encounter_id, dice_expression, min_level, max_level, min, max, result_text, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    encounter_id, dice_expression, min_level, max_level,
                    table_row.get("min"), table_row.get("max"), strip_tags(result), row_sort_order,
                ),
            )
            encounter_table_id = cur.fetchone()[0]
            row_sort_order += 1
            stats["rows"] += 1

            for i, ref in enumerate(_extract_creature_refs(result)):
                creature_id = _find_creature_id(cur, ref["name_raw"], creature_cache)
                cur.execute(
                    """
                    INSERT INTO encounter_table_creatures
                        (encounter_table_id, creature_id, creature_name_raw, quantity_formula, sort_order)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (encounter_table_id, creature_id, ref["name_raw"], ref["quantity_formula"], i),
                )
                stats["creature_refs"] += 1
                stats["matched" if creature_id else "unmatched"] += 1

    return stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Roll back instead of committing.")
    args = parser.parse_args()

    conn = psycopg2.connect(**DB_KWARGS)
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, name, raw_data FROM encounters
        WHERE resolution_type = 'random_table' AND raw_data IS NOT NULL
        ORDER BY name
        """
    )
    encounters = cur.fetchall()

    creature_cache: dict = {}
    totals = {"encounters": 0, "rows": 0, "creature_refs": 0, "matched": 0, "unmatched": 0}
    for encounter_id, name, raw_data in encounters:
        stats = process_encounter(cur, encounter_id, raw_data, creature_cache)
        totals["encounters"] += 1
        for k in ("rows", "creature_refs", "matched", "unmatched"):
            totals[k] += stats[k]
        print(
            f"encounter: {name} - {stats['rows']} table row(s), {stats['creature_refs']} creature ref(s) "
            f"({stats['matched']} matched, {stats['unmatched']} unmatched)"
        )

    print(
        f"\ndone. {totals['encounters']} encounter(s), {totals['rows']} table row(s), "
        f"{totals['creature_refs']} creature ref(s) total "
        f"({totals['matched']} matched, {totals['unmatched']} unmatched)."
    )

    if args.dry_run:
        conn.rollback()
        print("--dry-run: rolled back, nothing was written.")
    else:
        conn.commit()
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
