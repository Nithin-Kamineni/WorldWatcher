"""One-off seed script (not an Alembic migration - this is data, not schema) for the NPC
Tracker roleplay content: additional random_names entries plus the new random_appearances/
random_secrets/random_personalities/random_relationships banks.

Deliberately network-free (unlike import_5etools_names.py, which fetches 5etools'
names.json) so it has no external dependency. Names/appearance features/secrets/
relationships are transcribed from the user-supplied reference images
(random-table-images/NPC-names.png, NPC-Appearance.png, NPC-secrets.png) plus additional
hand-authored entries in the same style/spirit, per the user's "don't limit yourself to the
image" instruction. Personality mixes the reference image's "Monster Personality" combat
behaviors (NPC-MonsterPersonality.png) with classic PHB-style NPC personality traits.
Relationships mixes NPC-MonsterRelationShips.png's group dynamics with more general
NPC-to-NPC relationship prompts.

Re-runnable: random_names inserts are ON CONFLICT (name, name_type) DO NOTHING (existing
unique constraint). The four new banks have no uniqueness constraint (same as
random_motivations/random_pitfalls), so they're seeded only if currently empty.
"""
from __future__ import annotations

import asyncio
import os

import asyncpg

# ============================================================
# Names - 6 style categories from NPC-names.png, given name + surname pairs are NOT linked
# in the schema (random_names is a flat first/last pool, same as the existing 5etools-seeded
# bank) - each name is inserted independently as name_type 'first' or 'last'.
# ============================================================

IMAGE_GIVEN_NAMES = [
    # Common
    "Adrik", "Alvyn", "Aurora", "Eldeth", "Eldon", "Farris", "Kathra", "Kellen", "Lily",
    "Nissa", "Xinli", "Zorra",
    # Guttural
    "Abzug", "Bajok", "Bharash", "Grovis", "Gruuna", "Hokrun", "Mardred", "Rhogar",
    "Skuldark", "Thokk", "Urzul", "Varka",
    # Lyrical
    "Arannis", "Damaia", "Darsis", "Dweomer", "Evabeth", "Jhessail", "Keyleth", "Netheria",
    "Orianna", "Sorcyl", "Umarion", "Velissa",
    # Monosyllabic
    "Chen", "Creel", "Dain", "Dorn", "Flint", "Glim", "Henk", "Krusk", "Nox", "Nyx", "Rukh",
    "Shan",
    # Sinister
    "Arachne", "Axyss", "Carrion", "Grinnus", "Melkhis", "Morthos", "Nadir", "Scandal",
    "Skellendyre", "Thaltus", "Valkora", "Vexander",
    # Whimsical
    "Cricket", "Daisy", "Dimble", "Ellywick", "Erky", "Fiddlestyx", "Fonkin", "Golly",
    "Mimsy", "Pumpkin", "Quarrel", "Sybilwick",
]

IMAGE_SURNAMES = [
    # Common
    "Brightsun", "Dundragon", "Frostbeard", "Garrick", "Goodbarrel", "Greycastle",
    "Ironfist", "Jaerin", "Merryweather", "Redthorn", "Stormriver", "Wren",
    # Guttural
    "Burska", "Gruuthok", "Hrondl", "Jarzzok", "Kraltus", "Shamog", "Skrangval", "Ungart",
    "Uuthrakt", "Vrakir", "Yuldra", "Zulrax",
    # Lyrical
    "Arvannis", "Brawnanvil", "Daardendrian", "Drachedandion", "Endryss", "Meliamne",
    "Mishann", "Silverfrond", "Snowmantle", "Summerbreeze", "Thunderfoot", "Zashir",
    # Monosyllabic
    "Dench", "Drog", "Dusk", "Holg", "Horn", "Imsh", "Jask", "Keth", "Ku", "Kung", "Mott",
    "Quaal",
    # Sinister
    "Doomwhisper", "Dreadfield", "Gallows", "Hellstryke", "Killraven", "Nightblade",
    "Norixius", "Shadowfang", "Valtar", "Winterspell", "Xandros", "Zarkynzorn",
    # Whimsical
    "Borogove", "Goldjoy", "Hoddypeak", "Huddle", "Jollywind", "Oneshoe", "Scramblewise",
    "Sunnyhill", "Tallgrass", "Timbers", "Underbough", "Wimbly",
]

EXTRA_GIVEN_NAMES = [
    # Common
    "Brenna", "Corwin", "Dara", "Edrin", "Halden", "Marisol", "Perrin", "Wynne",
    # Guttural
    "Drozgul", "Ghazrik", "Kurgath", "Molgar", "Nazkul", "Ozrukk", "Thrognar", "Vugmash",
    # Lyrical
    "Aelindra", "Belanor", "Caelynn", "Faelivrin", "Ithreal", "Rosaline", "Talathiel",
    "Vaelara",
    # Monosyllabic
    "Bram", "Cael", "Dosk", "Grix", "Jek", "Molt", "Rask", "Thane",
    # Sinister
    "Blackmourn", "Corvina", "Damaris", "Grimhold", "Ilsevet", "Malachi", "Ravenna", "Sythe",
    # Whimsical
    "Buttercup", "Doodle", "Figgle", "Honeywell", "Ninny", "Pockets", "Squibble", "Tibbles",
]

EXTRA_SURNAMES = [
    # Common
    "Ashford", "Brightwater", "Coldwell", "Fairwind", "Hallow", "Larkspur", "Oakheart",
    "Thistledown",
    # Guttural
    "Bloodfang", "Dreknar", "Gorrthak", "Kralmog", "Nashgar", "Ruskthok", "Thurzak",
    "Vraknor",
    # Lyrical
    "Amakiir", "Duskryn", "Everleaf", "Larethian", "Moonwhisper", "Silversong", "Starryn",
    "Windriven",
    # Monosyllabic
    "Bolt", "Crag", "Fenn", "Grett", "Karr", "Molk", "Runt", "Vosk",
    # Sinister
    "Bloodmire", "Cinderfall", "Grimscythe", "Hexmoor", "Moroven", "Ravensworn",
    "Sablewrought", "Wraithmoor",
    # Whimsical
    "Applecheek", "Bumblefoot", "Cloverdew", "Dinglehopper", "Featherbrook", "Gigglewhistle",
    "Puddlejump", "Teacake",
]

# ============================================================
# Appearance features (NPC-Appearance.png 1d12 + additions)
# ============================================================
APPEARANCES = [
    "Distinctive jewelry",
    "Flamboyant, outlandish, formal, or ragged clothes",
    "Uses an elegant mobility device (wheelchair, brace, or cane)",
    "Pronounced scar",
    "Unusual eye color (or two different colors)",
    "Tattoos or piercings",
    "Birthmark",
    "Unusual hair color",
    "Bald, or braided beard or hair",
    "Distinctive nose (large, bulbous, angular, small)",
    "Distinctive posture (stooped or rigid)",
    "Exceptionally beautiful or ugly",
    "Missing a finger, hand, eye, or other body part",
    "Distinctive voice (raspy, booming, melodic, or squeaky)",
    "Unusual skin tone or texture (weathered, scaled, freckled)",
    "Wears a signature hat, mask, or hood",
    "Carries an ornate or unusual weapon as a status symbol",
    "Prematurely gray or stark white hair",
    "Perpetually stained or soot-covered hands",
    "Wears mismatched or borrowed clothing",
    "Faint magical glow or aura about them",
    "Unusually tall, short, or thin for their race",
    "Elaborate facial hair styled into braids or points",
    "Missing or blackened teeth",
    "Always seen with a small animal companion or familiar",
]

# ============================================================
# Secrets (NPC-secrets.png 1d10 + additions)
# ============================================================
SECRETS = [
    "The NPC is in disguise, concealing their identity or some aspect of their appearance.",
    "The NPC is currently planning, executing, or covering up a crime.",
    "The NPC (or their family) has been threatened with harm unless the NPC does something.",
    "The NPC is under a magical compulsion (perhaps a Geas spell or some kind of curse) to behave in a certain way.",
    "The NPC is seriously ill or in terrible pain.",
    "The NPC feels responsible for someone's death or ill fortune.",
    "The NPC is on the brink of financial ruin.",
    "The NPC is desperately lonely or harboring an unrequited passion.",
    "The NPC nurses a powerful ambition.",
    "The NPC is deeply dissatisfied or unhappy.",
    "The NPC is a spy for a rival faction or foreign power.",
    "The NPC secretly practices a forbidden or outlawed faith.",
    "The NPC owes a life debt they have not yet repaid.",
    "The NPC is not who their documents say they are - their true name is unknown to all.",
    "The NPC is slowly succumbing to a curse or transformation they hide from others.",
    "The NPC once betrayed someone close to them and has never confessed it.",
    "The NPC is secretly wealthy and hides it behind a modest lifestyle.",
    "The NPC is being blackmailed and pays regularly to keep a secret buried.",
    "The NPC is a member of a secret society operating within the settlement.",
    "The NPC is searching for a way to undo a mistake that hurt someone they love.",
]

# ============================================================
# Personality (NPC-MonsterPersonality.png 1d8 combat behaviors + classic NPC traits)
# ============================================================
PERSONALITIES = [
    "Cowardly; surrenders easily",
    "Greedy; wants treasure",
    "Boastful; makes a show of bravery but runs from danger",
    "Disorderly; poorly trained and easily rattled",
    "Fanatical; ready to die fighting",
    "Brave; stands firm against danger",
    "Jocular; taunts enemies",
    "Orderly; difficult to rattle",
    "Curious to a fault; can't resist investigating anything unusual",
    "Stubborn; rarely admits when they're wrong",
    "Kind-hearted; goes out of their way to help strangers",
    "Superstitious; reads omens into everyday events",
    "Blunt; says exactly what they think, tact be damned",
    "Meticulous; obsessed with order and precision",
    "Gossipy; can't keep a secret for long",
    "Suspicious of strangers and slow to trust",
    "Cheerful even in the face of disaster",
    "Melancholic; carries an air of quiet sadness",
    "Vain; preoccupied with appearance and reputation",
    "Generous to the point of self-neglect",
    "Quick-tempered; provoked easily",
    "Calculating; weighs every word before speaking",
    "Loyal to a fault, even to those who don't deserve it",
    "Absent-minded; frequently distracted by their own thoughts",
    "Flirtatious with nearly everyone they meet",
    "Pious; quotes scripture or proverbs constantly",
    "Frugal to the point of miserliness",
    "Restless; always looking for the next adventure or distraction",
    "Overly formal, even in casual settings",
    "Nervous laugher; jokes to defuse tense moments",
]

# ============================================================
# Relationships (NPC-MonsterRelationShips.png 1d6 group dynamics + general NPC prompts)
# ============================================================
RELATIONSHIPS = [
    "Has a bitter rivalry with another NPC; each wants the other to suffer.",
    "Bullied by others in their group, and flees at the first opportunity.",
    "Revered or even worshipped by their allies, who would die for them.",
    "Admired by their peers, who try to impress or help them.",
    "Cares only for themself, not the rest of their group.",
    "Bullies the rest of their group; forces them into danger, but they want them gone.",
    "Secretly related by blood to another prominent figure in the settlement.",
    "Owes a life debt to another NPC and will go to great lengths to repay it.",
    "A former lover of another NPC, and the parting was not amicable.",
    "Estranged from a sibling who lives nearby but hasn't spoken to them in years.",
    "Mentor to a younger NPC who doesn't yet know the mentor's true motives.",
    "Longtime friendly rival with another NPC in the same trade.",
    "In deep debt to a local moneylender or crime boss.",
    "Secretly working against their own family's interests.",
    "Fiercely protective of a child or ward who is not their own.",
    "Bound by an old oath or pact to another NPC they now regret trusting.",
    "Publicly cordial with, but privately despises, a fellow guild member.",
    "The unacknowledged parent of another NPC in the community.",
    "Was once saved from death by a stranger and has spent years searching for them.",
    "Considers a particular NPC their greatest inspiration, though they've never met.",
]


async def seed_names(conn: asyncpg.Connection) -> None:
    inserted = 0
    for name in IMAGE_GIVEN_NAMES + EXTRA_GIVEN_NAMES:
        result = await conn.execute(
            "INSERT INTO random_names (name, name_type) VALUES ($1, 'first') "
            "ON CONFLICT (name, name_type) DO NOTHING",
            name,
        )
        if result.endswith(" 1"):
            inserted += 1
    for name in IMAGE_SURNAMES + EXTRA_SURNAMES:
        result = await conn.execute(
            "INSERT INTO random_names (name, name_type) VALUES ($1, 'last') "
            "ON CONFLICT (name, name_type) DO NOTHING",
            name,
        )
        if result.endswith(" 1"):
            inserted += 1
    total = len(IMAGE_GIVEN_NAMES) + len(EXTRA_GIVEN_NAMES) + len(IMAGE_SURNAMES) + len(EXTRA_SURNAMES)
    print(f"random_names: inserted {inserted} new rows ({total - inserted} already present)")


async def seed_if_empty(conn: asyncpg.Connection, table: str, values: list[str]) -> None:
    existing = await conn.fetchval(f"SELECT count(*) FROM {table}")
    if existing == 0:
        for text in values:
            await conn.execute(f"INSERT INTO {table} (text) VALUES ($1)", text)
    print(f"{table}: {'seeded' if existing == 0 else 'already seeded'} ({len(values)} entries)")


async def main() -> None:
    conn = await asyncpg.connect(
        host=os.environ.get("WW_DB_HOST", "localhost"),
        port=int(os.environ.get("WW_DB_PORT", "5432")),
        database=os.environ.get("WW_DB_NAME", "WorldWatcher_DB"),
        user=os.environ.get("WW_DB_USER", "postgres"),
        password=os.environ.get("WW_DB_PASSWORD", ""),
    )
    try:
        await seed_names(conn)
        await seed_if_empty(conn, "random_appearances", APPEARANCES)
        await seed_if_empty(conn, "random_secrets", SECRETS)
        await seed_if_empty(conn, "random_personalities", PERSONALITIES)
        await seed_if_empty(conn, "random_relationships", RELATIONSHIPS)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
