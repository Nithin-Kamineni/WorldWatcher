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


def project_encounter(cur, encounter: dict, source_cache: dict):
    source_id = sources_mod.get_or_create_source(cur, source_cache, encounter.get("source"))
    name = encounter.get("name") or "(unnamed)"

    values = {
        "source_id": source_id,
        "campaign_id": None,
        "map_id": None,
        "page": encounter.get("page"),
        "resolution_type": "random_table",
        "tables": json.dumps(_parse_tables(encounter.get("tables"))),
        "name": name,
        "description": None,
        "raw_data": json.dumps(encounter),
    }

    encounter_id, was_insert = db_mod.upsert(
        cur, "encounters", ["name", "source_id"], values, conflict_where="source_id IS NOT NULL"
    )
    return encounter_id, was_insert
