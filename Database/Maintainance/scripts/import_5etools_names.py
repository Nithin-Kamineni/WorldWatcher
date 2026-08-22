"""One-off seed script (not an Alembic migration - this is data, not schema) for
Bugs.txt's NPC-creation randomizer banks: random_names, random_professions,
random_motivations, random_pitfalls.

Names come from 5etools' names.json (https://github.com/5etools-mirror-3/5etools-src/
blob/main/data/names.json), per-race/culture reroll tables shaped like:
    {"name": [{"name": "Dwarf", "source": "XGE",
               "tables": [{"option": "Female", "table": [{"result": "..."}]}, ...]}]}
Only the plain name strings are kept - `option` is classified into 'first' or 'last'
(case-insensitive: male/female/child/general -> first; clan/family/surname -> last;
anything else, e.g. Tiefling's "Virtue" nickname table, is discarded) and everything
else in the file (race/source/dice-table structure) is dropped except a small
`raw_data` provenance tag ({race, option, source}) on each row.

Professions/motivations/pitfalls have no source file - hand-authored below as a first
draft; flagged for a DM content-review pass.

Re-runnable: all inserts are ON CONFLICT DO NOTHING against the tables' unique
constraints, so running this again after the bank already exists is a no-op.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import urllib.request

import asyncpg

NAMES_JSON_URL = "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/names.json"

FIRST_NAME_HINTS = ("female", "male", "child", "general")
LAST_NAME_HINTS = ("clan", "family", "surname")

PROFESSIONS = [
    "Blacksmith", "Innkeeper", "Merchant", "Guard", "Farmer", "Sailor", "Scribe",
    "Alchemist", "Herbalist", "Cobbler", "Tailor", "Carpenter", "Mason", "Fisherman",
    "Hunter", "Trapper", "Miner", "Brewer", "Baker", "Butcher", "Weaver", "Cartographer",
    "Stablehand", "Wagoner", "Locksmith", "Jeweler", "Cooper", "Tanner", "Physician",
    "Priest", "Beggar", "Thief", "Mercenary", "Bard", "Moneylender", "Gravedigger",
]

MOTIVATIONS = [
    "Seeks to restore their family's lost honor.",
    "Believes they are destined for greatness and will do anything to prove it.",
    "Wants to protect their community from a growing threat.",
    "Is searching for a lost loved one.",
    "Wants to accumulate enough wealth to never worry again.",
]

PITFALLS = [
    "Has a gambling debt to a dangerous creditor.",
    "Is secretly working for a rival faction.",
    "Drinks too much and talks when they shouldn't.",
    "Is terrified of a specific, otherwise mundane thing.",
    "Holds a grudge that clouds their judgment.",
]


def classify_option(option: str) -> str | None:
    lowered = (option or "").lower()
    if any(hint in lowered for hint in FIRST_NAME_HINTS):
        return "first"
    if any(hint in lowered for hint in LAST_NAME_HINTS):
        return "last"
    return None


def fetch_names_json() -> dict:
    with urllib.request.urlopen(NAMES_JSON_URL, timeout=30) as resp:
        return json.load(resp)


def extract_names(data: dict) -> list[tuple[str, str, dict]]:
    """Returns (name, name_type, raw_data) tuples, deduped by (name, name_type)."""
    seen: set[tuple[str, str]] = set()
    rows: list[tuple[str, str, dict]] = []
    for entry in data.get("name", []):
        race = entry.get("name")
        source = entry.get("source")
        for table in entry.get("tables", []):
            option = table.get("option")
            name_type = classify_option(option)
            if not name_type:
                continue
            for row in table.get("table", []):
                result = row.get("result")
                if not result or not isinstance(result, str):
                    continue
                # Some entries are "Firstname Lastname" pairs even in a "first"/"last"
                # table (e.g. combined result strings) - keep only the first token to
                # avoid polluting the bank with multi-word joins; strip whitespace.
                name = re.split(r"\s+", result.strip())[0].strip(",")
                if not name:
                    continue
                key = (name, name_type)
                if key in seen:
                    continue
                seen.add(key)
                rows.append((name, name_type, {"race": race, "option": option, "source": source}))
    return rows


async def main() -> None:
    conn = await asyncpg.connect(
        host=os.environ.get("WW_DB_HOST", "localhost"),
        port=int(os.environ.get("WW_DB_PORT", "5432")),
        database=os.environ.get("WW_DB_NAME", "WorldWatcher_DB"),
        user=os.environ.get("WW_DB_USER", "postgres"),
        password=os.environ.get("WW_DB_PASSWORD", ""),
    )
    try:
        print("Fetching 5etools names.json...")
        data = fetch_names_json()
        rows = extract_names(data)
        print(f"Extracted {len(rows)} distinct (name, type) pairs")

        inserted = 0
        for name, name_type, raw_data in rows:
            result = await conn.execute(
                "INSERT INTO random_names (name, name_type, raw_data) VALUES ($1, $2, $3) "
                "ON CONFLICT (name, name_type) DO NOTHING",
                name, name_type, json.dumps(raw_data),
            )
            if result.endswith(" 1"):
                inserted += 1
        print(f"random_names: inserted {inserted} new rows ({len(rows) - inserted} already present)")

        for name in PROFESSIONS:
            await conn.execute(
                "INSERT INTO random_professions (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", name
            )
        print(f"random_professions: seeded {len(PROFESSIONS)} entries")

        existing_motivations = await conn.fetchval("SELECT count(*) FROM random_motivations")
        if existing_motivations == 0:
            for text in MOTIVATIONS:
                await conn.execute("INSERT INTO random_motivations (text) VALUES ($1)", text)
        print(f"random_motivations: {'seeded' if existing_motivations == 0 else 'already seeded'} ({len(MOTIVATIONS)} entries)")

        existing_pitfalls = await conn.fetchval("SELECT count(*) FROM random_pitfalls")
        if existing_pitfalls == 0:
            for text in PITFALLS:
                await conn.execute("INSERT INTO random_pitfalls (text) VALUES ($1)", text)
        print(f"random_pitfalls: {'seeded' if existing_pitfalls == 0 else 'already seeded'} ({len(PITFALLS)} entries)")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
