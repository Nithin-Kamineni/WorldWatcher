"""One-off DATA migration (not schema - the tables already exist, see
alembic revisions a3f8c1d9e2b6..d4b1a7e3c8f5 and
seed_random_tables_taxonomy.py, which must run first) that moves every row
out of the three old, differently-shaped "random table" designs into the
new unified random_tables/table_columns/table_entries engine, per the
user's explicit restructuring request: a random table's rollable items ARE
encounters, not the other way around.

Three sources, three shapes:

1. `encounters` rows with resolution_type='random_table' (5etools-imported
   wandering-monster tables, e.g. "Arctic", "Astral Sea Encounters" - 42
   rows) plus their `encounter_tables`/`encounter_table_creatures` child
   rows (2299/2568 rows). Each becomes ONE random_table (format=reference,
   category=Encounters>Wandering/Random), with each encounter_tables row
   promoted to its OWN standalone `encounters` row (primary_type=combat,
   roster built from encounter_table_creatures) that the new table_entries
   row references via kind=encounter_ref. The old container encounter is
   deleted afterward UNLESS something still points at it (checked against
   map_floors.locked_encounter_id) - if so it's left in place (its
   resolution_type/tables JSONB become dead weight but nothing breaks).

2. `random_encounter_tables` (1 row, "Sky fish") - a DM-built table whose
   entries already point at real Encounter ids. Those old ids include some
   of the *containers* from step 1 (i.e. it was built to cascade into
   another random table, not name a single fight), so this step must run
   AFTER step 1 and remaps any entry pointing at a migrated container onto
   the new random_table it became (kind=table_ref, format=cascading).
   Entries pointing at a real (non-container) encounter keep kind=
   encounter_ref.

3. `situational_tables` (16 rows, curated roleplay/exploration/adventure/
   loot tables) - each becomes one random_table (scene_generator if it has
   multiple columns, else lookup), category chosen per-table below, tags
   translated from the old freeform tags array into the new namespaced
   vocabulary.

Idempotent by construction: each step's target rows are looked up by name
before insert and skipped if a same-named random_table already exists, and
the source rows are only deleted at the very end of that step - so a
re-run after a partial failure just picks up where it left off. Network-
free (raw SQL over asyncpg), same shape as the other Maintainance scripts.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import uuid
from typing import Any, Optional

import asyncpg


def _jsonb(value: Any) -> Any:
    """asyncpg returns JSONB columns as raw JSON text (no codec registered),
    so every JSONB read needs this before it's usable as a dict/list."""
    if isinstance(value, str):
        return json.loads(value)
    return value

DICE_RE = re.compile(r"^(\d*)d(\d+)([+-]\d+)?$", re.IGNORECASE)
INT_RE = re.compile(r"^\d+$")
MIXED_DICE_RE = re.compile(r"^d(\d+)\+d(\d+)$", re.IGNORECASE)

# ---- env/creature-type keyword tags for the 42 wandering-monster tables ----
KEYWORD_TAGS: dict[str, list[str]] = {
    "arctic": ["env:arctic"], "astral": ["env:astral"], "sea": ["env:sea"], "coast": ["env:coast"],
    "giant": ["creature-type:giant"], "desert": ["env:desert"], "dinosaur": ["env:jungle"],
    "megafauna": ["env:jungle"], "elemental air": ["env:elemental-plane"], "elemental earth": ["env:elemental-plane"],
    "elemental fire": ["env:elemental-plane"], "elemental water": ["env:elemental-plane"],
    "fiendish": ["env:lower-planes", "creature-type:fiend"], "forest": ["env:forest"],
    "sylvan": ["env:forest", "env:feywild"], "grassland": ["env:grassland"], "hill": ["env:hill"],
    "mortuary": ["creature-type:undead", "env:ruins"], "mountain": ["env:mountain"], "open water": ["env:sea"],
    "planar": ["env:planar"], "ship": ["env:sea"], "sigil": ["env:planar"], "swamp": ["env:swamp"],
    "underdark": ["env:underdark"], "undersea": ["env:underwater"], "underwater": ["env:underwater"],
    "urban": ["env:urban"], "wildspace": ["env:astral"], "airborne": ["env:aerial"], "air battle": ["env:aerial"],
}

# ---- situational_tables name -> new category slug ----
SITUATIONAL_CATEGORY: dict[str, str] = {
    "Darkwood Forest": "scene-prompts",
    "The Rusty Anchor Tavern": "scene-prompts",
    "Market Street": "scene-prompts",
    "Forgotten Corridor": "scene-prompts",
    "Planar Rift": "scene-prompts",
    "Adventure Situations (Levels 1-4)": "adventure-premises",
    "Adventure Situations (Levels 5-10)": "adventure-premises",
    "Adventure Situations (Levels 11-16)": "adventure-premises",
    "Adventure Situations (Levels 17-20)": "adventure-premises",
    "Planar Adventure Situations": "adventure-premises",
    "Adventure Climax": "adventure-climaxes",
    "Patron Hooks": "adventure-hooks",
    "Supernatural Hooks": "adventure-hooks",
    "Happenstance Hooks": "adventure-hooks",
    "Individual Treasure": "individual-treasure",
    "Random Treasure Hoard": "treasure-hoards",
}
SITUATIONAL_EXTRA_TAGS: dict[str, list[str]] = {
    "Patron Hooks": ["topic:hook"],
    "Supernatural Hooks": ["topic:hook"],
    "Happenstance Hooks": ["topic:hook"],
    "Adventure Climax": ["topic:hook"],
    "Individual Treasure": ["topic:treasure", "source:dmg24"],
    "Random Treasure Hoard": ["topic:treasure", "source:dmg24"],
}
OLD_TAG_MAP: dict[str, str] = {
    "exploration": "pillar:exploration", "roleplay": "phase:improv", "forest": "env:forest",
    "wilderness": "theme:wilderness", "tavern": "topic:tavern", "social": "pillar:social",
    "city": "env:urban", "urban": "env:urban", "dungeon": "env:dungeon", "planar": "env:planar",
    "adventure-hook": "topic:hook", "dmg": "source:dmg24", "treasure": "topic:treasure",
}


def parse_die(expr: Optional[str], fallback_max: int) -> tuple[int, int, int]:
    if expr:
        m = DICE_RE.match(expr.replace(" ", ""))
        if m:
            count = int(m.group(1)) if m.group(1) else 1
            return count, int(m.group(2)), int(m.group(3) or 0)
    return 1, max(1, fallback_max), 0


def mixed_dice_weights(expr: Optional[str]) -> dict[int, int] | None:
    """Return exact outcome frequencies for expressions such as ``d12 + d8``."""
    match = MIXED_DICE_RE.match((expr or "").replace(" ", ""))
    if not match:
        return None
    first, second = int(match.group(1)), int(match.group(2))
    weights: dict[int, int] = {}
    for a in range(1, first + 1):
        for b in range(1, second + 1):
            weights[a + b] = weights.get(a + b, 0) + 1
    return weights


def tags_for_name(name: str) -> list[str]:
    lname = name.lower()
    tags: set[str] = {"pillar:combat", "topic:encounter"}
    for keyword, kw_tags in KEYWORD_TAGS.items():
        if keyword in lname:
            tags.update(kw_tags)
    return sorted(tags)


class Ctx:
    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn
        self.category_by_slug: dict[str, uuid.UUID] = {}
        self.format_by_slug: dict[str, uuid.UUID] = {}
        self.tag_by_key: dict[str, uuid.UUID] = {}

    async def load(self):
        for row in await self.conn.fetch("SELECT id, slug FROM category"):
            self.category_by_slug[row["slug"]] = row["id"]
        for row in await self.conn.fetch("SELECT id, slug FROM table_formats"):
            self.format_by_slug[row["slug"]] = row["id"]
        for row in await self.conn.fetch("SELECT id, namespace, value FROM tag"):
            self.tag_by_key[f"{row['namespace']}:{row['value']}"] = row["id"]

    async def tag_id(self, key: str) -> Optional[uuid.UUID]:
        if key in self.tag_by_key:
            return self.tag_by_key[key]
        namespace, _, value = key.partition(":")
        if not namespace or not value:
            return None
        new_id = uuid.uuid4()
        await self.conn.execute(
            "INSERT INTO tag (id, namespace, value, label, is_system) VALUES ($1,$2,$3,$4,false) ON CONFLICT DO NOTHING",
            new_id, namespace, value, value.replace("-", " ").title(),
        )
        row = await self.conn.fetchrow("SELECT id FROM tag WHERE namespace=$1 AND value=$2", namespace, value)
        self.tag_by_key[key] = row["id"]
        return row["id"]

    async def tag_random_table(self, table_id: uuid.UUID, keys: list[str]) -> None:
        for key in keys:
            tid = await self.tag_id(key)
            if tid:
                await self.conn.execute(
                    "INSERT INTO random_table_tag (table_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", table_id, tid
                )


async def migrate_wandering_containers(ctx: Ctx) -> dict[uuid.UUID, uuid.UUID]:
    """Step 1. Returns {old_container_encounter_id: new_random_table_id}."""
    conn = ctx.conn
    old_to_new: dict[uuid.UUID, uuid.UUID] = {}
    containers = await conn.fetch("SELECT id, name, source_id FROM encounters WHERE resolution_type = 'random_table'")
    locked_ids = {r["locked_encounter_id"] for r in await conn.fetch("SELECT locked_encounter_id FROM map_floors WHERE locked_encounter_id IS NOT NULL")}
    reference_category = ctx.category_by_slug["encounters-combat"]
    wandering_category = ctx.category_by_slug["encounters-wandering"]
    reference_format = ctx.format_by_slug["reference"]

    for container in containers:
        # Disambiguate a name collision (e.g. two different source books both
        # have an "Urban" wandering table) using the source book, so the
        # unique-name idempotency check below can't conflate two containers.
        source_row = await conn.fetchrow("SELECT name FROM sources WHERE id = $1", container["source_id"]) if container["source_id"] else None
        target_name = container["name"]
        if any(c["name"] == container["name"] and c["id"] != container["id"] for c in containers):
            target_name = f"{container['name']} ({source_row['name']})" if source_row else f"{container['name']} ({container['id']})"

        existing = await conn.fetchrow("SELECT id FROM random_tables WHERE name = $1 AND is_system = true", target_name)
        if existing:
            old_to_new[container["id"]] = existing["id"]
            print(f"  [skip, already migrated] {target_name}")
            continue

        table_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO random_tables (id, name, category_id, format_id, is_system, source_book) VALUES ($1,$2,$3,$4,true,'5etools import')",
            table_id, target_name, wandering_category, reference_format,
        )
        await ctx.tag_random_table(table_id, tags_for_name(container["name"]))
        old_to_new[container["id"]] = table_id

        rows = await conn.fetch(
            "SELECT * FROM encounter_tables WHERE encounter_id = $1 ORDER BY min_level NULLS FIRST, max_level NULLS FIRST, min",
            container["id"],
        )
        groups: dict[tuple, list] = {}
        for row in rows:
            key = (row["dice_expression"], row["min_level"], row["max_level"])
            groups.setdefault(key, []).append(row)

        for col_idx, ((dice_expr, min_level, max_level), group_rows) in enumerate(groups.items()):
            fallback_max = max((r["max"] for r in group_rows), default=20)
            die_count, die_sides, die_modifier = parse_die(dice_expr, fallback_max)
            sum_weights = mixed_dice_weights(dice_expr)
            if sum_weights:
                await conn.execute("UPDATE random_tables SET format_id=$2 WHERE id=$1", table_id, ctx.format_by_slug["weighted_pool"])
            col_name = f"Levels {min_level}-{max_level}" if min_level or max_level else "Result"
            column_id = uuid.uuid4()
            await conn.execute(
                "INSERT INTO table_columns (id, table_id, name, die_count, die_sides, die_modifier, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)",
                column_id, table_id, col_name, die_count, die_sides, die_modifier, col_idx,
            )

            for row in group_rows:
                raw_name = (row["result_text"] or f"{container['name']} encounter").strip()
                child_name = raw_name[:497] + ("…" if len(raw_name) > 497 else "")

                # encounters has a UNIQUE(name, source_id) partial index - the same
                # result text legitimately recurs across different wandering tables
                # sharing a source book, so reuse that encounter rather than erroring.
                existing_child = await conn.fetchrow(
                    "SELECT id FROM encounters WHERE name = $1 AND source_id IS NOT DISTINCT FROM $2", child_name, container["source_id"]
                )
                if existing_child:
                    child_id = existing_child["id"]
                else:
                    child_id = uuid.uuid4()
                    await conn.execute(
                        """INSERT INTO encounters (id, name, description, primary_type, category_id, status, source_id, campaign_id)
                           VALUES ($1,$2,$3,'combat',$4,'ready',$5,NULL)""",
                        child_id, child_name, row["result_text"], reference_category, container["source_id"],
                    )
                    creatures = await conn.fetch(
                        "SELECT * FROM encounter_table_creatures WHERE encounter_table_id = $1 ORDER BY sort_order", row["id"]
                    )
                    for sort_order, creature_row in enumerate(creatures):
                        formula = creature_row["quantity_formula"] or "1"
                        if INT_RE.match(formula):
                            quantity, notes = int(formula), None
                        else:
                            quantity, notes = 1, f"Quantity: {formula}"
                        await conn.execute(
                            """INSERT INTO encounter_creatures (id, encounter_id, creature_id, custom_name, quantity, sort_order, notes)
                               VALUES ($1,$2,$3,$4,$5,$6,$7)""",
                            uuid.uuid4(), child_id, creature_row["creature_id"],
                            None if creature_row["creature_id"] else creature_row["creature_name_raw"],
                            quantity, sort_order, notes,
                        )
                weight = sum(sum_weights.get(total, 0) for total in range(row["min"], row["max"] + 1)) if sum_weights else None
                await conn.execute(
                    "INSERT INTO table_entries (id, column_id, min, max, weight, kind, encounter_id, sort_order) VALUES ($1,$2,$3,$4,$5,'encounter_ref',$6,$7)",
                    uuid.uuid4(), column_id, row["min"], row["max"], weight, child_id, row["min"],
                )

        print(f"  migrated '{target_name}': {len(groups)} column(s), {len(rows)} entries")

    deleted, kept = 0, 0
    for container in containers:
        if container["id"] in locked_ids:
            kept += 1
            continue
        # Only delete if it was actually migrated this run or a previous one (guarded above).
        await conn.execute("DELETE FROM encounters WHERE id = $1", container["id"])
        deleted += 1
    print(f"containers: {deleted} deleted, {kept} kept (still referenced by a map floor)")
    return old_to_new


async def migrate_random_encounter_tables(ctx: Ctx, old_to_new_container: dict[uuid.UUID, uuid.UUID]) -> None:
    """Step 2."""
    conn = ctx.conn
    rows = await conn.fetch("SELECT * FROM random_encounter_tables")
    wandering_category = ctx.category_by_slug["encounters-wandering"]
    cascading_format = ctx.format_by_slug["cascading"]

    for row in rows:
        existing = await conn.fetchrow("SELECT id FROM random_tables WHERE name = $1", row["name"])
        if existing:
            print(f"  [skip, already migrated] {row['name']}")
            continue

        entries = _jsonb(row["entries"]) or []
        any_cascading = any(uuid.UUID(e["encounter_id"]) in old_to_new_container for e in entries)
        format_id = cascading_format if any_cascading else ctx.format_by_slug["reference"]

        table_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO random_tables (id, name, category_id, format_id, is_system) VALUES ($1,$2,$3,$4,false)",
            table_id, row["name"], wandering_category, format_id,
        )
        await ctx.tag_random_table(table_id, ["pillar:combat", "topic:encounter"])

        die_count, die_sides, die_modifier = parse_die(row["die_expression"], len(entries))
        column_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO table_columns (id, table_id, name, die_count, die_sides, die_modifier, sort_order) VALUES ($1,$2,'Result',$3,$4,$5,0)",
            column_id, table_id, die_count, die_sides, die_modifier,
        )
        for i, entry in enumerate(entries, start=1):
            old_encounter_id = uuid.UUID(entry["encounter_id"])
            if old_encounter_id in old_to_new_container:
                await conn.execute(
                    "INSERT INTO table_entries (id, column_id, min, max, kind, target_table_id, sort_order) VALUES ($1,$2,$3,$3,'table_ref',$4,$3)",
                    uuid.uuid4(), column_id, i, old_to_new_container[old_encounter_id],
                )
            else:
                await conn.execute(
                    "INSERT INTO table_entries (id, column_id, min, max, kind, encounter_id, sort_order) VALUES ($1,$2,$3,$3,'encounter_ref',$4,$3)",
                    uuid.uuid4(), column_id, i, old_encounter_id,
                )
        print(f"  migrated '{row['name']}': {len(entries)} entries")

    if rows:
        await conn.execute("DELETE FROM random_encounter_tables")
        print(f"random_encounter_tables: {len(rows)} row(s) migrated and cleared")


async def migrate_situational_tables(ctx: Ctx) -> None:
    """Step 3."""
    conn = ctx.conn
    rows = await conn.fetch("SELECT * FROM situational_tables")
    lookup_format = ctx.format_by_slug["lookup"]
    scene_format = ctx.format_by_slug["scene_generator"]

    for row in rows:
        existing = await conn.fetchrow("SELECT id FROM random_tables WHERE name = $1 AND is_system = true", row["name"])
        if existing:
            print(f"  [skip, already migrated] {row['name']}")
            continue

        category_slug = SITUATIONAL_CATEGORY.get(row["name"], "scene-prompts")
        columns = _jsonb(row["columns"]) or []
        format_id = scene_format if len(columns) > 1 else lookup_format
        combine_template = None
        if len(columns) > 1:
            combine_template = ", ".join(f"{{{c['label']}}}" for c in columns)

        table_id = uuid.uuid4()
        await conn.execute(
            """INSERT INTO random_tables (id, name, description, category_id, format_id, combine_template, source_book, is_system)
               VALUES ($1,$2,$3,$4,$5,$6,$7,true)""",
            table_id, row["name"], row["description"], ctx.category_by_slug[category_slug], format_id,
            combine_template, row["source"],
        )
        old_tags = list(_jsonb(row["tags"]) or [])
        new_tags = [OLD_TAG_MAP[t] for t in old_tags if t in OLD_TAG_MAP]
        new_tags += SITUATIONAL_EXTRA_TAGS.get(row["name"], [])
        await ctx.tag_random_table(table_id, new_tags)

        for col_idx, col in enumerate(columns):
            entries = col.get("entries", [])
            die_sides = col.get("dieSize") or len(entries) or 1
            column_id = uuid.uuid4()
            await conn.execute(
                "INSERT INTO table_columns (id, table_id, name, die_count, die_sides, sort_order) VALUES ($1,$2,$3,1,$4,$5)",
                column_id, table_id, col.get("label", "Result"), die_sides, col_idx,
            )
            for entry in entries:
                roll = entry["roll"]
                await conn.execute(
                    "INSERT INTO table_entries (id, column_id, min, max, kind, text, sort_order) VALUES ($1,$2,$3,$3,'text',$4,$3)",
                    uuid.uuid4(), column_id, roll, entry["text"],
                )
        print(f"  migrated '{row['name']}': {len(columns)} column(s)")

    if rows:
        await conn.execute("DELETE FROM situational_tables")
        print(f"situational_tables: {len(rows)} row(s) migrated and cleared")


async def main() -> None:
    conn = await asyncpg.connect(
        host=os.environ.get("WW_DB_HOST", "localhost"),
        port=int(os.environ.get("WW_DB_PORT", "5432")),
        database=os.environ.get("WW_DB_NAME", "WorldWatcher_DB"),
        user=os.environ.get("WW_DB_USER", "postgres"),
        password=os.environ.get("WW_DB_PASSWORD", ""),
    )
    ctx = Ctx(conn)
    try:
        await ctx.load()
        if not ctx.category_by_slug or not ctx.format_by_slug:
            raise SystemExit("Run seed_random_tables_taxonomy.py first (category/table_formats empty).")

        print("== Step 1: wandering-monster encounter containers ==")
        old_to_new = await migrate_wandering_containers(ctx)

        print("== Step 2: DM-built random_encounter_tables ==")
        await migrate_random_encounter_tables(ctx, old_to_new)

        print("== Step 3: curated situational_tables ==")
        await migrate_situational_tables(ctx)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
