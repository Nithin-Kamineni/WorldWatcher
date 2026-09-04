"""Stage 4 (encounter). encounters.json is 5etools' *random encounter
table* format, not a fixed roster: each entry has one or more `tables`
(banded by character level in some books), each table has its own
`diceExpression` and a list of {min, max, result} rows, where `result` is
free text with embedded {@creature ...} / {@dice ...} markup and no
structured creature-role array.

This projector stores the whole `tables` array as-is in the `tables` JSONB
column (so nothing is lost - the DM can always read the original text) but
also pre-parses each row's `result` once into a tag-stripped `resultText`
plus a `creatures` array of {name, source, countDice, countFixed}, so the
client never needs to run a 5etools-tag parser itself. See
_parse_creatures() below for the pairing heuristic.
"""
import json
import re
import hashlib

from .. import db as db_mod
from .. import sources as sources_mod
from ..text import strip_tags

_CREATURE_TAG_RE = re.compile(r"\{@creature ([^}|]+)(?:\|([^}|]*))?(?:\|([^}]*))?\}")
_DICE_TAG_RE = re.compile(r"\{@dice ([^}|]+)(?:\|[^}]*)?\}")

_NUMBER_WORDS = {
    "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
    "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
}

# A dice tag counts as this creature's quantity only if it sits immediately
# before the {@creature ...} tag (optionally separated by whitespace) -
# otherwise it's unrelated flavor text (e.g. an "attitude: {@dice 1d12}"
# aside) that happens to precede a *later* creature mention in the row.
_ADJACENT_DICE_RE = re.compile(r"(\{@dice ([^}|]+)(?:\|[^}]*)?\})\s*$")
_TRAILING_WORD_RE = re.compile(r"(\w+)\s*\(?\s*$")


def _parse_creatures(result: str) -> list:
    creatures = []
    for m in _CREATURE_TAG_RE.finditer(result):
        name = strip_tags(m.group(1)).strip()
        source = (m.group(2) or "").strip() or None
        preceding = result[: m.start()]

        count_dice = None
        count_fixed = None
        adj = _ADJACENT_DICE_RE.search(preceding)
        if adj:
            count_dice = adj.group(2).strip()
        else:
            word_match = _TRAILING_WORD_RE.search(preceding)
            if word_match:
                word = word_match.group(1).lower()
                if word.isdigit():
                    count_fixed = int(word)
                elif word in _NUMBER_WORDS:
                    count_fixed = _NUMBER_WORDS[word]

        if count_dice is None and count_fixed is None:
            count_fixed = 1

        creatures.append({"name": name, "source": source, "countDice": count_dice, "countFixed": count_fixed})
    return creatures


def _parse_tables(tables: list) -> list:
    parsed = []
    for t in tables or []:
        rows = []
        for row in t.get("table") or []:
            result = row.get("result") or ""
            rows.append({
                "min": row.get("min"),
                "max": row.get("max"),
                "result": result,
                "resultText": strip_tags(result),
                "creatures": _parse_creatures(result),
            })
        parsed.append({
            "diceExpression": t.get("diceExpression"),
            "minlvl": t.get("minlvl"),
            "maxlvl": t.get("maxlvl"),
            "table": rows,
        })
    return parsed


def _encounter_title(prose: str) -> str:
    """Imported encounter names are prose sentences; cards need scan-friendly titles."""
    text = prose.lower()
    rules = [
        (("airship", "pirate"), "Raiders of the Open Sky"), (("pirate",), "The Black-Sail Ambush"),
        (("dragon",), "Wings on the Horizon"), (("undead",), "The Restless Dead"),
        (("skeleton",), "The Restless Dead"), (("zombie",), "The Restless Dead"),
        (("fiend",), "A Bargain in Brimstone"), (("demon",), "A Bargain in Brimstone"),
        (("celestial",), "Judgment from Above"), (("giant",), "Footfalls Like Thunder"),
        (("goblin",), "Knives in the Brush"), (("bandit",), "The Roadside Reckoning"),
        (("merchant",), "Terms on the Road"), (("storm",), "Under a Wrathful Sky"),
        (("ruin",), "Secrets Beneath the Stones"), (("forest",), "Whispers Between the Trees"),
        (("ship",), "Trouble on the Tide"), (("cavern",), "Echoes in the Deep"),
    ]
    title = None
    for needles, candidate in rules:
        if all(needle in text for needle in needles):
            title = candidate
            break
    if title is None:
        first_creature_match = _CREATURE_TAG_RE.search(prose)
        first_creature = strip_tags(first_creature_match.group(1)).strip() if first_creature_match else None
        title = f"An Encounter with {first_creature}" if first_creature else "Danger at the Crossroads"
    # name+source is the importer's stable conflict key. A small prose hash
    # prevents two encounters with the same recommended title from collapsing.
    return f"{title} · {hashlib.sha1(prose.encode('utf-8')).hexdigest()[:4].upper()}"


def _infer_pillar(prose: str) -> str:
    text = prose.lower()
    if any(word in text for word in ("parley", "negotiate", "merchant", "conversation", "diplomat")):
        return "social"
    if any(word in text for word in ("hazard", "trap", "clue", "trail", "weather", "ruin")):
        return "exploration"
    return "combat"


def project_encounter(cur, encounter: dict, source_cache: dict):
    source_id = sources_mod.get_or_create_source(cur, source_cache, encounter.get("source"))
    prose = encounter.get("name") or "(unnamed)"
    pillar = _infer_pillar(prose)

    values = {
        "source_id": source_id,
        "campaign_id": None,
        "map_id": None,
        "page": encounter.get("page"),
        "resolution_type": "random_table",
        "tables": json.dumps(_parse_tables(encounter.get("tables"))),
        "name": _encounter_title(prose),
        "description": prose,
        "primary_type": pillar,
        "status": "ready",
        "read_aloud": prose,
        "objective": {
            "combat": "Break the opposition's advantage and force it to retreat, surrender, or yield the objective.",
            "social": "Discover what the other party truly wants and secure a workable agreement.",
            "exploration": "Identify the danger, find a safe route through it, and preserve any useful clues.",
        }[pillar],
        "tags": ["imported", pillar],
        "raw_data": json.dumps(encounter),
    }

    # Prefer the immutable upstream prose stored in raw_data when re-importing:
    # the enrichment migration intentionally changes the display name, so name
    # alone is no longer a safe idempotency key for an existing database.
    cur.execute(
        "SELECT id FROM encounters WHERE source_id = %s AND raw_data->>'name' = %s LIMIT 1",
        (source_id, prose),
    )
    existing = cur.fetchone()
    if existing:
        encounter_id, was_insert = existing[0], False
        assignments = ", ".join(f"{column} = %s" for column in values)
        cur.execute(f"UPDATE encounters SET {assignments} WHERE id = %s", [*values.values(), encounter_id])
    else:
        encounter_id, was_insert = db_mod.upsert(
            cur, "encounters", ["name", "source_id"], values, conflict_where="source_id IS NOT NULL"
        )
    return encounter_id, was_insert
