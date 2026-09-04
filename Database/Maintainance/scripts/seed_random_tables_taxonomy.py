"""One-off seed script (not an Alembic migration - this is data, not schema) for the
Random Tables + Encounters overhaul: the curated category tree (Task 2.2), the tag
vocabulary (Task 3.2), the table-format registry (Task 4.2/4.3), and a worked-example
"Quick NPC" generator with its four small component tables (Task 6.4).

Deliberately network-free and idempotent, same shape as seed_situational_tables.py:
every insert is keyed by slug/namespace+value and skipped if that row already exists,
so re-running this script after a partial run (or after adding new curated rows) is
safe.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid

import asyncpg

from seed_npc_quick_roll_generator import seed_npc_builder
from seed_place_builders import seed_place_builders
from seed_encounter_builders import seed_encounter_builders
from seed_dm_toolkit_tables import repair_imported_d100_ranges, repair_legacy_mixed_dice, seed_dm_toolkit_tables

# ============================================================
# Category tree (Task 2.2) - (slug, name, [children])
# ============================================================
CATEGORY_TREE = [
    ("encounters", "Encounters", [
        ("encounters-combat", "Combat", []),
        ("encounters-social", "Social", []),
        ("encounters-exploration", "Exploration", []),
        ("encounters-mixed", "Mixed", []),
        ("encounters-wandering", "Wandering / Random", []),
        ("encounters-set-piece-pointers", "Set-piece Pointers", []),
    ]),
    ("adventure-plot", "Adventure & Plot", [
        ("adventure-premises", "Premises / Concepts", []),
        ("adventure-hooks", "Hooks / Introductions", []),
        ("adventure-villains", "Villains", []),
        ("adventure-allies-patrons", "Allies & Patrons", []),
        ("adventure-complications", "Complications / Twists", []),
        ("adventure-climaxes", "Climaxes / Endings", []),
        ("adventure-templates", "Adventure Templates", []),
    ]),
    ("npcs-creatures", "NPCs & Creatures", [
        ("npc-generation", "NPC Generation", []),
        ("monster-behavior", "Monster Behavior / Motivation", []),
        ("monster-flavor", "Monster Flavor / Lore", []),
        ("monster-lists", "Monster Lists", []),
        ("names", "Names", []),
    ]),
    ("locations-settlements", "Locations & Settlements", [
        ("countries", "Countries", []),
        ("settlements", "Settlements", []),
        ("buildings", "Buildings", []),
        ("dungeons", "Dungeons", []),
        ("wilderness-features", "Wilderness Features / Landmarks", []),
        ("regions-geography", "Regions / Geography", []),
    ]),
    ("environment-travel", "Environment & Travel", [
        ("weather", "Weather", []),
        ("travel-events", "Travel Events / Navigation", []),
        ("time-calendar", "Time / Calendar / Seasonal", []),
        ("planar-effects", "Planar Effects & Phenomena", []),
    ]),
    ("hazards-traps-afflictions", "Hazards, Traps & Afflictions", [
        ("traps", "Traps", []),
        ("environmental-hazards", "Environmental Hazards", []),
        ("curses", "Curses", []),
        ("diseases", "Diseases", []),
        ("poisons", "Poisons", []),
        ("madness-fear-stress", "Madness / Fear & Stress", []),
        ("wild-magic-mishaps", "Wild Magic / Mishaps", []),
        ("chase-complications", "Chase Complications", []),
    ]),
    ("treasure-rewards", "Treasure & Rewards", [
        ("coins-currency", "Coins / Currency", []),
        ("gems-art-objects", "Gems & Art Objects", []),
        ("magic-items", "Magic Items", []),
        ("treasure-hoards", "Treasure Hoards", []),
        ("individual-treasure", "Individual Treasure", []),
        ("trinkets-curios", "Trinkets / Curios", []),
        ("item-quirks", "Item Quirks / Sentient Traits", []),
        ("non-item-rewards", "Non-item Rewards", []),
    ]),
    ("flavor-roleplay", "Flavor & Roleplay", [
        ("scene-prompts", "Scene Prompts / Vignettes", []),
        ("rumors-gossip", "Rumors & Gossip", []),
        ("overheard-conversations", "Overheard Conversations", []),
        ("dreams-visions-omens", "Dreams / Visions / Omens", []),
        ("sensory-dressing", "Sensory Dressing", []),
    ]),
    ("downtime-campaign", "Downtime & Campaign", [
        ("downtime-activity-outcomes", "Downtime Activity Outcomes", []),
        ("faction-events", "Faction Events / Reputation", []),
        ("bastion-events", "Bastion Events", []),
        ("between-session-complications", "Between-session Complications", []),
        ("life-events-backgrounds", "Life Events / Backgrounds", []),
    ]),
    ("custom-homebrew", "Custom / Homebrew", []),
    ("sourced-tables", "Sourced Tables (Unsorted)", []),
]

# ============================================================
# Tag vocabulary (Task 3.2) - namespace -> [values]
# ============================================================
TAGS: dict[str, list[str]] = {
    "npc-name-style": ["devilish", "whimsical", "noble", "rugged"],
    "npc-occupation": ["artisan", "criminal", "scholar", "wilderness"],
    "npc-background": ["criminal", "smuggler", "folk-hero", "noble"],
    "npc-theme": ["nature", "artisan", "intrigue", "whimsical", "dark"],
    "pillar": ["combat", "social", "exploration", "mixed"],
    "env": [
        "arctic", "coast", "desert", "forest", "grassland", "hill", "jungle", "mountain",
        "swamp", "marsh", "cave", "underdark", "subterranean", "underwater", "sea", "river",
        "lake", "road", "ruins", "urban", "rural", "wasteland", "volcanic", "aerial", "dungeon",
        "feywild", "shadowfell", "elemental-plane", "upper-planes", "lower-planes", "astral",
        "ethereal", "planar",
    ],
    "tier": ["tier-1", "tier-2", "tier-3", "tier-4", "lvl-1-4", "lvl-5-10", "lvl-11-16", "lvl-17-20"],
    "difficulty": ["trivial", "low", "moderate", "high", "deadly"],
    "tod": ["dawn", "day", "dusk", "night"],
    "season": ["spring", "summer", "autumn", "winter"],
    "climate": ["temperate", "tropical", "arid", "cold"],
    "creature-type": [
        "aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend",
        "giant", "humanoid", "monstrosity", "ooze", "plant", "undead",
    ],
    "theme": [
        "horror", "mystery", "intrigue", "heist", "comedy", "gothic", "whimsy", "grimdark",
        "epic", "survival", "political", "war", "nautical", "romance", "dungeon-crawl",
        "wilderness", "urban-intrigue", "cosmic",
    ],
    "topic": [
        "encounter", "hook", "villain", "npc", "monster", "settlement", "building", "tavern",
        "shop", "temple", "dungeon", "trap", "hazard", "curse", "disease", "poison", "madness",
        "treasure", "magic-item", "trinket", "weather", "travel", "rumor", "name", "faction",
        "bastion", "puzzle", "chase", "scene", "dream", "omen", "quest",
    ],
    "rarity": ["common", "uncommon", "rare", "very-rare", "legendary", "artifact", "cursed", "sentient"],
    "outcome": ["boon", "bane", "neutral", "complication", "reward", "twist"],
    "phase": ["prep", "at-table", "travel", "downtime", "worldbuilding", "improv", "session-zero"],
    "party": ["solo", "duet", "small", "standard", "large"],
    "source": ["phb24", "dmg24", "mm24", "xge", "tce", "vrgr", "fizban", "bigby", "srd", "homebrew", "third-party"],
    "cw": [
        "gore", "body-horror", "death", "torture", "self-harm", "arachnids", "drowning", "fire",
        "mind-control", "undead", "disease", "religious", "slavery", "child-endangerment",
    ],
}


def _label(value: str) -> str:
    return value.replace("-", " ").replace("_", " ").title()


# ============================================================
# Table formats (Task 4.2/4.3) - (slug, name, description, tier)
# ============================================================
FORMATS = [
    ("lookup", "Lookup", "One die roll maps to one result via min-max ranges. Entries may embed dice in their text (e.g. \"2d4 wolves\"). Workhorse for d20/d100 tables.", "core"),
    ("weighted_pool", "Weighted Pool", "Each entry has an integer weight; pick weighted-random. Lets authors set odds directly instead of juggling ranges.", "core"),
    ("reference", "Reference", "Entries point at stored Encounters/NPCs/creatures/items instead of text - \"roll to pull a full encounter\".", "core"),
    ("scene_generator", "Scene Generator", "Multiple independent columns, each rolled separately, combined via a template (e.g. Encounter + Behavior + Complication).", "core"),
    ("cascading", "Cascading", "An entry triggers a roll on another table (nested tables).", "core"),
    ("generator", "Generator", "A multi-column encounter table: each component contains several encounter results and the rolled components are combined with a template.", "core"),
    ("check_table", "Check Table", "Roll + a modifier, read against DC bands or outcome tiers. Powers reaction rolls, morale checks, and crit-success -> crit-failure ladders.", "advanced"),
    ("oracle", "Oracle", "Yes/no resolution weighted by likelihood, returning yes-and / yes / yes-but / no-but / no / no-and.", "advanced"),
    ("chance_gate", "Chance Gate", "A probability check per interval (e.g. 15% per hour of travel); on a hit, fires a follow-up table.", "advanced"),
    ("clock", "Clock / Escalating", "Results shift as a counter advances; the table has intensity bands and a rising tension/alarm/doom value selects the band.", "advanced"),
    ("deck", "Deck", "Draw without replacement until reshuffle; guarantees no repeats (unique rumors, a card reading, clues doled out one at a time).", "advanced"),
    ("countdown_deck", "Countdown Deck", "A depleting deck where each draw also advances doom or spends a resource; when empty, something bad locks in.", "advanced"),
    ("branching", "Branching", "The next table depends on the previous result or game state (a flowchart of tables).", "advanced"),
    ("sequence", "Sequence", "Produces an ordered series (roll five, they happen in order): a travel montage, a multi-day journey, festival beats.", "advanced"),
    ("grid", "Grid", "2D coordinate lookup (d6xd6 \"d66\", or a hex-map region table); roll two dice as x/y.", "advanced"),
    ("bundle", "Bundle (Record)", "One roll returns a pre-linked multi-field record (creature + count + terrain + twist meant to go together).", "advanced"),
]


async def seed_category(conn: asyncpg.Connection) -> dict[str, uuid.UUID]:
    slug_to_id: dict[str, uuid.UUID] = {}
    existing = await conn.fetch("SELECT id, slug FROM category")
    for row in existing:
        slug_to_id[row["slug"]] = row["id"]

    async def upsert(slug: str, name: str, parent_slug: str | None, sort_order: int) -> None:
        if slug in slug_to_id:
            return
        parent_id = slug_to_id[parent_slug] if parent_slug else None
        new_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO category (id, slug, name, parent_id, is_system, sort_order) VALUES ($1,$2,$3,$4,true,$5)",
            new_id, slug, name, parent_id, sort_order,
        )
        slug_to_id[slug] = new_id

    for i, (slug, name, children) in enumerate(CATEGORY_TREE):
        await upsert(slug, name, None, i)
        for j, (cslug, cname, _grandchildren) in enumerate(children):
            await upsert(cslug, cname, slug, j)

    print(f"category: {len(slug_to_id)} nodes present")
    return slug_to_id


async def seed_tags(conn: asyncpg.Connection) -> dict[str, uuid.UUID]:
    key_to_id: dict[str, uuid.UUID] = {}
    existing = await conn.fetch("SELECT id, namespace, value FROM tag")
    for row in existing:
        key_to_id[f"{row['namespace']}:{row['value']}"] = row["id"]

    count_before = len(key_to_id)
    for namespace, values in TAGS.items():
        for value in values:
            key = f"{namespace}:{value}"
            if key in key_to_id:
                continue
            new_id = uuid.uuid4()
            await conn.execute(
                "INSERT INTO tag (id, namespace, value, label, is_system) VALUES ($1,$2,$3,$4,true)",
                new_id, namespace, value, _label(value),
            )
            key_to_id[key] = new_id

    print(f"tag: {len(key_to_id)} values present ({len(key_to_id) - count_before} inserted)")
    return key_to_id


async def seed_formats(conn: asyncpg.Connection) -> dict[str, uuid.UUID]:
    slug_to_id: dict[str, uuid.UUID] = {}
    existing = await conn.fetch("SELECT id, slug FROM table_formats")
    for row in existing:
        slug_to_id[row["slug"]] = row["id"]

    for slug, name, description, tier in FORMATS:
        if slug in slug_to_id:
            await conn.execute(
                "UPDATE table_formats SET name = $2, description = $3, tier = $4 WHERE id = $1",
                slug_to_id[slug], name, description, tier,
            )
            continue
        new_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO table_formats (id, slug, name, description, tier, is_system) VALUES ($1,$2,$3,$4,$5,true)",
            new_id, slug, name, description, tier,
        )
        slug_to_id[slug] = new_id

    print(f"table_formats: {len(slug_to_id)} formats present")
    return slug_to_id


async def _create_lookup_table(
    conn: asyncpg.Connection,
    name: str,
    category_id: uuid.UUID,
    format_id: uuid.UUID,
    entries: list[str],
    tag_ids: dict[str, uuid.UUID],
    entry_tags: dict[int, list[str]] | None = None,
) -> uuid.UUID:
    """A single-column lookup table with N equal-weight entries (die size = len(entries))."""
    existing = await conn.fetchrow("SELECT id FROM random_tables WHERE name = $1", name)
    if existing:
        return existing["id"]
    table_id = uuid.uuid4()
    await conn.execute(
        "INSERT INTO random_tables (id, name, category_id, format_id, is_system, source_book) VALUES ($1,$2,$3,$4,true,'Quick NPC worked example')",
        table_id, name, category_id, format_id,
    )
    column_id = uuid.uuid4()
    await conn.execute(
        "INSERT INTO table_columns (id, table_id, name, die_count, die_sides) VALUES ($1,$2,'Result',1,$3)",
        column_id, table_id, len(entries),
    )
    for i, text in enumerate(entries, start=1):
        entry_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO table_entries (id, column_id, min, max, kind, text, sort_order) VALUES ($1,$2,$3,$3,'text',$4,$3)",
            entry_id, column_id, i, text,
        )
        for tag_key in (entry_tags or {}).get(i, []):
            if tag_key in tag_ids:
                await conn.execute(
                    "INSERT INTO table_entry_tag (entry_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
                    entry_id, tag_ids[tag_key],
                )
    return table_id


async def seed_quick_npc_generator(
    conn: asyncpg.Connection, category_ids: dict[str, uuid.UUID], format_ids: dict[str, uuid.UUID], tag_ids: dict[str, uuid.UUID]
) -> None:
    """Task 6.4 worked example: appearance/motivation/secret are fixed slots,
    occupation is constrained by the `environment` parameter (tag-filtered)."""
    existing = await conn.fetchrow("SELECT id FROM generators WHERE slug = 'quick-npc'")
    if existing:
        print("generators: quick-npc already present")
        return

    npc_category = category_ids["npc-generation"]
    lookup_format = format_ids["lookup"]

    appearance_table = await _create_lookup_table(
        conn, "Quick NPC - Appearance", npc_category, lookup_format,
        ["weathered and scarred", "impeccably groomed", "gaunt and hollow-eyed", "broad-shouldered and imposing",
         "small and quick-eyed", "richly dressed", "travel-worn", "unnervingly calm"],
        tag_ids,
    )
    occupation_table = await _create_lookup_table(
        conn, "Quick NPC - Occupation", npc_category, lookup_format,
        ["hunter", "merchant", "dockhand", "guard captain", "herbalist", "smuggler",
         "innkeeper", "cultist", "beggar", "sailor", "scholar", "blacksmith"],
        tag_ids,
        entry_tags={
            1: ["env:forest"], 5: ["env:forest"],
            2: ["env:urban"], 4: ["env:urban"], 8: ["env:urban"],
            3: ["env:coast"], 10: ["env:coast"], 6: ["env:coast"],
            9: ["env:urban"], 11: ["env:urban"], 12: ["env:urban"],
        },
    )
    motivation_table = await _create_lookup_table(
        conn, "Quick NPC - Motivation", npc_category, lookup_format,
        ["wants money", "seeks revenge", "protects a secret", "craves recognition",
         "wants to escape their past", "serves a hidden master", "wants to belong", "seeks redemption"],
        tag_ids,
    )
    secret_table = await _create_lookup_table(
        conn, "Quick NPC - Secret", npc_category, lookup_format,
        ["is secretly in debt to a crime lord", "is not who they claim to be", "once betrayed a friend",
         "is a spy for a rival faction", "is hiding a magical affliction", "witnessed a murder and said nothing"],
        tag_ids,
    )

    generator_id = uuid.uuid4()
    parameters = [
        {"key": "environment", "label": "Environment", "type": "tag", "allowed_tags": ["env:forest", "env:urban", "env:coast"], "required": False, "default": None},
        {"key": "tone", "label": "Tone", "type": "text", "allowed_tags": [], "required": False, "default": None},
    ]
    await conn.execute(
        "INSERT INTO generators (id, slug, name, category_id, description, combine_template, parameters, is_system) "
        "VALUES ($1,'quick-npc','Quick NPC',$2,$3,$4,$5::jsonb,true)",
        generator_id, npc_category,
        "Worked example (Task 6.4) - generates a quick NPC, with occupation constrained by the environment parameter.",
        "A {appearance} {occupation} who wants {motivation}. Secret: {secret}.",
        json.dumps(parameters),
    )
    components = [
        (appearance_table, "appearance", None, 0),
        (occupation_table, "occupation", "environment", 1),
        (motivation_table, "motivation", None, 2),
        (secret_table, "secret", None, 3),
    ]
    for table_id, slot, filter_key, sort_order in components:
        await conn.execute(
            "INSERT INTO generator_components (id, generator_id, table_id, output_slot, filter_param_key, sort_order) "
            "VALUES ($1,$2,$3,$4,$5,$6)",
            uuid.uuid4(), generator_id, table_id, slot, filter_key, sort_order,
        )
    print("generators: seeded quick-npc worked example")


async def main() -> None:
    conn = await asyncpg.connect(
        host=os.environ.get("WW_DB_HOST", "localhost"),
        port=int(os.environ.get("WW_DB_PORT", "5432")),
        database=os.environ.get("WW_DB_NAME", "WorldWatcher_DB"),
        user=os.environ.get("WW_DB_USER", "postgres"),
        password=os.environ.get("WW_DB_PASSWORD", ""),
    )
    try:
        async with conn.transaction():
            category_ids = await seed_category(conn)
            tag_ids = await seed_tags(conn)
            format_ids = await seed_formats(conn)
            await seed_quick_npc_generator(conn, category_ids, format_ids, tag_ids)
            await seed_npc_builder(conn)
            await seed_place_builders(conn)
            await seed_encounter_builders(conn)
            repaired = await repair_imported_d100_ranges(conn)
            mixed = await repair_legacy_mixed_dice(conn)
            await seed_dm_toolkit_tables(conn)
        print(f"random_tables: repaired {repaired} legacy d100 range endpoints")
        print(f"random_tables: repaired weights on {mixed} legacy d12+d8 entries")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
