"""One-off seed script (not an Alembic migration - this is data, not schema) for the Places
tab's randomizer reference banks (Countries/Settlements/Buildings/Dungeons).

Deliberately network-free, same shape as seed_npc_roleplay_banks.py. Dungeon states-of-ruin/
quirks, shop types, tavern name parts, and the four settlement 1-roll tables are transcribed
verbatim from the user-supplied reference images (random-table-images/Dungeon-StateOfRuin.png,
Dungeon-Quirks.png, Buildings-Shops.png, Buildings-TavernNames.png,
Settlements-DefiningTrait.png, Settlements-ClaimsToFame.png, Settlements-CurrentCalamities.png,
Settlements-LocalLeaders.png) - each d100/d20/d12 range collapses to one flat text entry,
unweighted, matching every other bank in this app (random_motivations etc. are also flat
unweighted lists). Economic Sources and Rumors & Hooks have no reference image and are
hand-authored in the same tone, per the user's go-ahead.

Re-runnable: every table here has no uniqueness constraint (same as random_motivations/
random_pitfalls), so each is seeded only if currently empty.
"""
from __future__ import annotations

import asyncio
import os

import asyncpg

# ============================================================
# Dungeons
# ============================================================

DUNGEON_STATES_OF_RUIN = [
    "Perilous — The area is dangerously worn and prone to collapse. Any impacts or damage "
    "to the structure, including from spells and other areas of effect, have a 50 percent "
    "chance of causing a collapse.",
    "Crumbling — Areas within the dungeon section are choked with rubble and have a 50 "
    "percent chance of being Difficult Terrain. Half Cover and hiding places are plentiful.",
    "Neglected — One dungeon hazard—such as brown mold, green slime, or yellow "
    "mold—is abundant.",
    "Abandoned — Most of the dungeon is deserted. Dexterity (Stealth) checks have "
    "Disadvantage because any sounds stand out as unusual.",
    "Secure — Ability checks made to break down doors, open locks, or carry out similar "
    "activities have Disadvantage.",
    "Thriving — The dungeon is heavily populated. Any loud noises draw the attention of "
    "nearby creatures.",
]

DUNGEON_QUIRKS = [
    "Abandoned after internal strife devastated its population",
    "Abandoned because the site was cursed by a god or other powerful entity",
    "Abandoned by its original creators when a plague spread through the dungeon",
    "Amazingly well preserved ancient city inside a dome encased in volcanic ash, submerged "
    "underwater, or entombed in desert sands",
    "Built as a fortress guarding a mountain pass",
    "Built as a maze, either to protect treasure from intruders or as a gauntlet where "
    "prisoners were hunted by monsters",
    "Built as a stronghold but abandoned after it fell to invaders",
    "Built as a treasure vault to protect powerful magic items and great wealth",
    "Built atop a cloud",
    "Built beneath a city in catacombs or sewers",
    "Built beneath or on top of a mesa or several connected mesas",
    "Built by a religious group to serve as a temple and linked to the energy of other planes "
    "of existence",
    "Built by dwarves and decorated with enormous dwarven faces that have been defaced by its "
    "current inhabitants",
    "Built in a volcano",
    "Built in or among the branches of a tree",
    "Built to house a planar portal but abandoned when creatures or energy from the other side "
    "of the portal seeped into the dungeon",
    "Carved into a meteorite (before or after it fell to earth)",
    "Carved into a sheer cliff face",
    "Caverns carved by a beholder's disintegration eye ray, with unnaturally smooth walls and "
    "vertical shafts connecting different levels",
    "Contains something that led to the downfall of its creators or inhabitants",
    "Dug as a burrow by a monster that might still live inside",
    "Entrance concealed behind a waterfall",
    "Floating on the sea",
    "Intended as a death trap to eliminate any creature that enters, perhaps to guard a "
    "treasure or to harvest souls for a necromantic rite",
    "Intended as a tomb",
    "Long known as the site of a great miracle or another auspicious event",
    "Made by amphibious creatures (such as kuo-toa or aboleths), using water to protect the "
    "innermost reaches from air-breathing intruders",
    "Made by a powerful spellcaster (perhaps a lich) as a site for magical research and "
    "experimentation",
    "Made by giants at a vast scale",
    "Natural caverns featuring a range of strikingly beautiful rock and crystal formations",
    "On an island in an underground sea",
    "On the back of a Gargantuan creature",
    "Originally constructed as a mine but abandoned when tunnels connected to dangerous "
    "Underdark tunnels",
    "Secreted away in a demiplane or in a pocket dimension",
    "Slowly abandoned as its creators died out or migrated away",
    "Transformed by multiple events or disasters over the course of centuries",
]

# ============================================================
# Buildings
# ============================================================

SHOP_TYPES = [
    "Pawnshop", "Apothecary", "Grocer", "Delicatessen", "Potter", "Undertaker", "Bookstore",
    "Moneylender", "Armorer", "Chandler", "Smithy", "Carpenter", "Weaver", "Jeweler", "Baker",
    "Mapmaker", "Tailor", "Ropemaker", "Mason", "Scribe",
]

TAVERN_NAME_FIRST_PARTS = [
    "The Golden", "The Silver", "The Beardless", "The Laughing", "The Dancing", "The Gilded",
    "The Stumbling", "The Wolf and", "The Fallen", "The Leering", "The Drunken", "The Wine and",
    "The Roaring", "The Frowning", "The Barrel and", "The Thirsty", "The Wandering",
    "The Barking", "The Happy", "The Witch and",
]

TAVERN_NAME_SECOND_PARTS = [
    "Lyre", "Dolphin", "Dwarf", "Pegasus", "Hut", "Rose", "Stag", "Duck", "Lamb", "Demon",
    "Goat", "Spirit", "Horde", "Jester", "Bucket", "Crow", "Satyr", "Dog", "Spider", "Dragon",
]

# ============================================================
# Settlements
# ============================================================

SETTLEMENT_DEFINING_TRAITS = [
    "Fortified outer wall",
    "Lots of gardens, parks, and greenery",
    "Lots of mud, filth, and litter",
    "Sprawling cemetery",
    "Lingering fog",
    "Noise and smoke from smithies and forges",
    "Canals and bridges",
    "Cliffs on one or more sides",
    "Clean streets and well-maintained buildings",
    "Ancient ruins within the settlement",
    "Impressive structure (such as a keep, temple, circle of standing stones, or ziggurat)",
]

SETTLEMENT_CLAIMS_TO_FAME = [
    "Delicious food", "Rude people", "Friendly folk", "Artists or writers", "Great hero/savior",
    "Flowers", "Seasonal festival", "Hauntings", "Spellcasters", "Decadence", "Piety",
    "Gambling", "Godlessness", "Education", "Wines", "High fashion", "Political intrigue",
    "Powerful guilds", "Patriotism", "Ancient ruins",
]

SETTLEMENT_CALAMITIES = [
    "Monsters infest the settlement.",
    "A key figure died; murder is suspected.",
    "War brews between rival guilds or gangs.",
    "A plague or famine sparks riots.",
    "Monsters attack anyone who approaches or leaves the settlement.",
    "Trade disputes cause economic hardship.",
    "A natural disaster threatens the settlement.",
    "A prophecy of doom has residents on edge.",
    "Locals are being drafted to fight in a war.",
    "Political or religious strife threatens violence.",
    "The settlement is under siege.",
    "Scandal threatens powerful local families.",
]

SETTLEMENT_LOCAL_LEADERS = [
    "Respected, fair, and just leader or council",
    "Feared tyrant",
    "Coward manipulated by others",
    "Illegitimate leader causing civil unrest",
    "Powerful monster",
    "Mysterious, anonymous conspirators",
    "Contested leadership (with open fighting)",
    "Acrimonious council unable to make decisions",
    "Doltish lout",
    "Dying leader (with disputed succession)",
    "Iron-willed and respected leader or council",
    "Religious leader or council",
]

# Hand-authored - no reference image (user's "research some options" ask).
SETTLEMENT_ECONOMIC_SOURCES = [
    "Agriculture and livestock farming",
    "Fishing and whaling fleets",
    "Timber and lumber milling",
    "Mining (ore, gems, or precious metals)",
    "Crossroads trade and caravan tolls",
    "Textile weaving and dyeing",
    "Wine, mead, or ale brewing",
    "Shipbuilding and naval trade",
    "Fur trapping and leatherworking",
    "Enchanted item crafting and magic trade",
    "Alchemy, herbalism, and potion-brewing",
    "Quarrying stone and masonry",
    "Banking, moneylending, and finance",
    "Mercenary contracts and sellsword companies",
    "Religious pilgrimage and temple tithes",
    "Smuggling and black-market trade",
    "Horse and livestock breeding",
    "Arcane academy tuition and scholarship",
]

# Hand-authored - no reference image (user's "research some options" ask).
SETTLEMENT_RUMORS_HOOKS = [
    "A merchant's last caravan never arrived, and the roads have gone quiet since.",
    "Livestock have been found drained of blood on the outskirts of town.",
    "A local noble is secretly buying up debts to seize property once owners default.",
    "Strange lights have been seen over the old ruins outside the settlement at night.",
    "A traveling healer has cured the incurable — for a price nobody will name.",
    "The well water has taken on a strange taste, and no one will admit to knowing why.",
    "A wanted criminal is rumored to be hiding in plain sight, posing as a respected local.",
    "Children have started repeating words in a language no scholar here recognizes.",
    "A rival settlement has sent envoys demanding tribute or \"arrangements will be made.\"",
    "An old vault beneath the settlement was sealed generations ago — someone wants it "
    "opened.",
    "A prominent family's heir vanished the night before their wedding.",
    "A cult is recruiting quietly, offering protection from a threat no one else has seen.",
    "Someone is buying every rat, raven, and stray dog in town at absurd prices.",
    "A dying local leaves behind a map, and several people are suddenly very interested.",
    "Guards have started disappearing on the night watch, and their replacements ask no "
    "questions.",
    "A festival relic went missing during last year's celebration and hasn't been mentioned "
    "since.",
    "A merchant guild is undercutting every competitor and no one can explain how.",
    "Someone has been leaving coins on doorsteps at night, always in threes.",
]


async def seed_if_empty(conn: asyncpg.Connection, table: str, values: list[str]) -> None:
    existing = await conn.fetchval(f"SELECT count(*) FROM {table}")
    if existing == 0:
        for text in values:
            await conn.execute(f"INSERT INTO {table} (text) VALUES ($1)", text)
    print(f"{table}: {'seeded' if existing == 0 else 'already seeded'} ({len(values)} entries)")


async def seed_tavern_name_parts(conn: asyncpg.Connection) -> None:
    existing = await conn.fetchval("SELECT count(*) FROM random_tavern_name_parts")
    if existing == 0:
        for text in TAVERN_NAME_FIRST_PARTS:
            await conn.execute(
                "INSERT INTO random_tavern_name_parts (text, part_type) VALUES ($1, 'first')", text
            )
        for text in TAVERN_NAME_SECOND_PARTS:
            await conn.execute(
                "INSERT INTO random_tavern_name_parts (text, part_type) VALUES ($1, 'second')", text
            )
    total = len(TAVERN_NAME_FIRST_PARTS) + len(TAVERN_NAME_SECOND_PARTS)
    print(f"random_tavern_name_parts: {'seeded' if existing == 0 else 'already seeded'} ({total} entries)")


async def main() -> None:
    conn = await asyncpg.connect(
        host=os.environ.get("WW_DB_HOST", "localhost"),
        port=int(os.environ.get("WW_DB_PORT", "5432")),
        database=os.environ.get("WW_DB_NAME", "WorldWatcher_DB"),
        user=os.environ.get("WW_DB_USER", "postgres"),
        password=os.environ.get("WW_DB_PASSWORD", ""),
    )
    try:
        await seed_if_empty(conn, "random_dungeon_states_of_ruin", DUNGEON_STATES_OF_RUIN)
        await seed_if_empty(conn, "random_dungeon_quirks", DUNGEON_QUIRKS)
        await seed_if_empty(conn, "random_shop_types", SHOP_TYPES)
        await seed_tavern_name_parts(conn)
        await seed_if_empty(conn, "random_settlement_defining_traits", SETTLEMENT_DEFINING_TRAITS)
        await seed_if_empty(conn, "random_settlement_claims_to_fame", SETTLEMENT_CLAIMS_TO_FAME)
        await seed_if_empty(conn, "random_settlement_calamities", SETTLEMENT_CALAMITIES)
        await seed_if_empty(conn, "random_settlement_local_leaders", SETTLEMENT_LOCAL_LEADERS)
        await seed_if_empty(conn, "random_settlement_economic_sources", SETTLEMENT_ECONOMIC_SOURCES)
        await seed_if_empty(conn, "random_settlement_rumors_hooks", SETTLEMENT_RUMORS_HOOKS)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
