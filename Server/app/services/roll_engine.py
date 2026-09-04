"""Task 5.2/5.3 + 6.3: the dice/probability core and the per-format roll dispatch.

Kept dependency-free (no DB access) - callers (the random_tables/generators
routers) fetch the table/columns/entries/tag rows first and pass plain data
in, so this module is trivially unit-testable and reusable from both the
random-table roll endpoint and the cascading/reference hydration path.

FORMAT_CONFIG shapes (random_tables.format_config JSONB), only read when the
format needs a parameter beyond columns/entries:
  chance_gate:    {"chance_percent": 15}
  clock:          {"doom_max": 10}
  countdown_deck: {"doom_per_draw": 1, "doom_max": 10}
  sequence:       {"sequence_length": 5}
  grid:           {"row_die_sides": 6, "col_die_sides": 6}
"""
from __future__ import annotations

import random
import re
from dataclasses import dataclass, field
from typing import Any, Optional

DICE_RE = re.compile(r"\b(\d*)d(\d+)([+-]\d+)?\b", re.IGNORECASE)


@dataclass
class DieSpec:
    count: int = 1
    sides: int = 20
    modifier: int = 0


@dataclass
class RolledDie:
    sides: int
    result: int


@dataclass
class RollOutcome:
    """One entry's roll result, ready for the API response."""

    dice: list[RolledDie]
    total: int
    entry_id: Optional[str] = None
    kind: str = "text"
    text: Optional[str] = None
    resolved_text: Optional[str] = None
    ref_id: Optional[str] = None
    column_name: Optional[str] = None
    extra: dict[str, Any] = field(default_factory=dict)


def roll_die_spec(spec: DieSpec) -> tuple[list[RolledDie], int]:
    dice = [RolledDie(sides=spec.sides, result=random.randint(1, spec.sides)) for _ in range(max(1, spec.count))]
    total = sum(d.result for d in dice) + spec.modifier
    return dice, total


def resolve_embedded_dice(text: Optional[str]) -> Optional[str]:
    """Rolls any "NdM[+/-K]" dice notation embedded in entry text (e.g. "2d4
    wolves") and appends the rolled value in parentheses, e.g. "2d4 (6)
    wolves" (Task 5.3.1)."""
    if not text:
        return text

    def _sub(m: re.Match) -> str:
        count = int(m.group(1)) if m.group(1) else 1
        sides = int(m.group(2))
        modifier = int(m.group(3)) if m.group(3) else 0
        if count > 100 or sides > 1000:
            return m.group(0)
        total = sum(random.randint(1, sides) for _ in range(count)) + modifier
        return f"{m.group(0)} ({total})"

    return DICE_RE.sub(_sub, text)


def _entry_matches(entry: dict, roll: int, secondary_roll: Optional[int] = None) -> bool:
    lo, hi = entry.get("min"), entry.get("max")
    if lo is not None and hi is not None:
        if not (lo <= roll <= hi):
            return False
    if secondary_roll is not None:
        slo, shi = entry.get("secondary_min"), entry.get("secondary_max")
        if slo is not None and shi is not None and not (slo <= secondary_roll <= shi):
            return False
    return True


def _entry_to_outcome(entry: dict, dice: list[RolledDie], total: int, column_name: Optional[str] = None) -> RollOutcome:
    kind = entry.get("kind", "text")
    ref_id = entry.get(f"{kind.split('_')[0]}_id") if kind != "text" else None
    # kind is one of text/encounter_ref/table_ref/creature_ref/npc_ref/item_ref -
    # the FK column sharing its prefix (encounter_id/target_table_id/creature_id/
    # npc_id/item_id) holds the reference.
    ref_field = {
        "encounter_ref": "encounter_id",
        "table_ref": "target_table_id",
        "creature_ref": "creature_id",
        "npc_ref": "npc_id",
        "item_ref": "item_id",
    }.get(kind)
    ref_id = str(entry[ref_field]) if ref_field and entry.get(ref_field) else None
    outcome = RollOutcome(
        dice=dice,
        total=total,
        entry_id=str(entry["id"]),
        kind=kind,
        text=entry.get("text"),
        resolved_text=resolve_embedded_dice(entry.get("text")),
        ref_id=ref_id,
        column_name=column_name,
    )
    if entry.get("bundle") is not None:
        outcome.extra["bundle"] = entry["bundle"]
    return outcome


def pick_lookup(entries: list[dict], die: DieSpec, column_name: Optional[str] = None) -> RollOutcome:
    ordered = sorted(entries, key=lambda entry: entry.get("sort_order", 0))
    explicit_ranges = [entry for entry in ordered if entry.get("min") is not None and entry.get("max") is not None]

    # Imported reference lists often have no printed die at all. Treat those as a
    # positional 1dN table instead of trying to roll the legacy zero-sided die.
    # If a positive side count is configured, only the first N rows participate;
    # this intentionally supports arbitrary sizes such as d7, d13, or d37.
    if not explicit_ranges:
        rollable_count = min(die.sides, len(ordered)) if die.sides > 0 else len(ordered)
        if rollable_count <= 0:
            return RollOutcome(dice=[], total=0, column_name=column_name)
        dice, total = roll_die_spec(DieSpec(count=1, sides=rollable_count))
        return _entry_to_outcome(ordered[total - 1], dice, total, column_name)

    # Older imports may contain valid explicit ranges alongside die_sides=0.
    # Recover the intended upper bound from those ranges so they remain rollable.
    effective_die = die
    if die.sides <= 0:
        highest = max(int(entry["max"]) for entry in explicit_ranges)
        effective_die = DieSpec(count=1, sides=max(1, highest), modifier=0)
    dice, total = roll_die_spec(effective_die)
    match = next((e for e in explicit_ranges if _entry_matches(e, total)), None)
    if match is None and entries:
        # No range covers the roll (shouldn't happen if validated on save) -
        # fall back to the closest entry rather than erroring at the table.
        match = min(explicit_ranges, key=lambda e: abs(int(e["min"]) - total))
    if match is None:
        return RollOutcome(dice=dice, total=total, column_name=column_name)
    return _entry_to_outcome(match, dice, total, column_name)


def pick_weighted(entries: list[dict], column_name: Optional[str] = None) -> RollOutcome:
    weighted = [e for e in entries if (e.get("weight") or 0) > 0] or entries
    weights = [e.get("weight") or 1 for e in weighted]
    choice = random.choices(weighted, weights=weights, k=1)[0] if weighted else None
    if choice is None:
        return RollOutcome(dice=[], total=0, column_name=column_name)
    return _entry_to_outcome(choice, [], 0, column_name)


def pick_grid(entries: list[dict], row_die: DieSpec, col_die: DieSpec, column_name: Optional[str] = None) -> RollOutcome:
    row_dice, row_total = roll_die_spec(row_die)
    col_dice, col_total = roll_die_spec(col_die)
    match = next((e for e in entries if _entry_matches(e, row_total, col_total)), None)
    outcome = _entry_to_outcome(match, row_dice + col_dice, row_total, column_name) if match else RollOutcome(
        dice=row_dice + col_dice, total=row_total, column_name=column_name
    )
    outcome.extra["row"] = row_total
    outcome.extra["col"] = col_total
    return outcome


def pick_deck(entries: list[dict], drawn_ids: set[str], column_name: Optional[str] = None) -> RollOutcome:
    remaining = [e for e in entries if str(e["id"]) not in drawn_ids]
    pool = remaining or entries  # reshuffle when exhausted
    ordered = sorted(pool, key=lambda e: e.get("sort_order", 0))
    choice = random.choice(ordered) if ordered else None
    if choice is None:
        return RollOutcome(dice=[], total=0, column_name=column_name)
    outcome = _entry_to_outcome(choice, [], 0, column_name)
    outcome.extra["reshuffled"] = not remaining
    outcome.extra["remaining_after"] = max(0, len(remaining) - 1)
    return outcome


def pick_clock(entries: list[dict], counter: int, column_name: Optional[str] = None) -> RollOutcome:
    match = next((e for e in entries if _entry_matches(e, counter)), None)
    outcome = _entry_to_outcome(match, [], counter, column_name) if match else RollOutcome(dice=[], total=counter, column_name=column_name)
    outcome.extra["counter"] = counter
    return outcome


def pick_check(entries: list[dict], die: DieSpec, modifier: int, column_name: Optional[str] = None) -> RollOutcome:
    dice, roll_total = roll_die_spec(die)
    total = roll_total + modifier
    match = next((e for e in entries if _entry_matches(e, total)), None)
    outcome = _entry_to_outcome(match, dice, total, column_name) if match else RollOutcome(dice=dice, total=total, column_name=column_name)
    outcome.extra["modifier"] = modifier
    return outcome


ORACLE_LADDER = ["no_and", "no", "no_but", "yes_but", "yes", "yes_and"]


def pick_oracle(likelihood: float, column_name: Optional[str] = None) -> RollOutcome:
    """likelihood in [0,1] shifts a d100 roll onto the 6-rung ladder (Task 4.3.2)."""
    dice, roll = roll_die_spec(DieSpec(count=1, sides=100))
    # Center the ladder on `likelihood`: each rung is ~1/6 of the range, shifted
    # by how far likelihood sits from 0.5.
    shift = (likelihood - 0.5) * 100
    adjusted = max(1, min(100, roll + shift))
    idx = min(5, int(adjusted // (100 / 6)))
    outcome = RollOutcome(dice=dice, total=roll, kind="text", text=ORACLE_LADDER[idx].replace("_", "-"))
    outcome.resolved_text = outcome.text
    outcome.column_name = column_name
    outcome.extra["likelihood"] = likelihood
    return outcome


def pick_chance_gate(chance_percent: float) -> tuple[bool, RolledDie]:
    die = RolledDie(sides=100, result=random.randint(1, 100))
    return die.result <= chance_percent, die


def roll_column(
    column: dict,
    entries: list[dict],
    format_slug: str,
    *,
    modifier: int = 0,
    counter: int = 0,
    drawn_ids: Optional[set[str]] = None,
    row_sides: Optional[int] = None,
    col_sides: Optional[int] = None,
) -> RollOutcome:
    die = DieSpec(count=column.get("die_count", 1), sides=column.get("die_sides", 20), modifier=column.get("die_modifier", 0))
    name = column.get("name")
    if format_slug == "weighted_pool" or format_slug == "deck" and not drawn_ids:
        pass
    if format_slug in ("lookup", "reference", "scene_generator", "generator", "cascading", "branching", "bundle"):
        return pick_lookup(entries, die, name)
    if format_slug == "weighted_pool":
        return pick_weighted(entries, name)
    if format_slug in ("deck", "countdown_deck"):
        return pick_deck(entries, drawn_ids or set(), name)
    if format_slug == "clock":
        return pick_clock(entries, counter, name)
    if format_slug == "check_table":
        return pick_check(entries, die, modifier, name)
    if format_slug == "grid":
        return pick_grid(entries, DieSpec(sides=row_sides or die.sides), DieSpec(sides=col_sides or die.sides), name)
    # sequence/branching/chance_gate are handled by the router (they need
    # multiple rolls or a separate probability step) but fall back to a
    # plain lookup so an unrecognized/new format still does something sane.
    return pick_lookup(entries, die, name)
