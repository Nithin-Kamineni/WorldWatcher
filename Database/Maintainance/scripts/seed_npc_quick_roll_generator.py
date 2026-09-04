"""Seed the system NPC Builder and its independently rollable component tables.

The builder is intentionally stored as a normal composite ``generator``.  That keeps every
attribute reusable as an ordinary table while the client can give this generator its richer
choose -> roll -> apply workflow.  Re-running this script repairs the generator's component
list and never duplicates tables or entries.
"""
from __future__ import annotations

import asyncio
import os
import uuid

import asyncpg


GENERATOR_SLUG = "npc-builder"
SOURCE = "WorldWatcher NPC Builder"

NPC_FACETS = {
    "npc-name-style": ["devilish", "whimsical", "noble", "rugged"],
    "npc-occupation": ["artisan", "criminal", "scholar", "wilderness"],
    "npc-background": ["criminal", "smuggler", "folk-hero", "noble"],
    "npc-theme": ["nature", "artisan", "intrigue", "whimsical", "dark"],
}

OCCUPATION_TAGS = [
    ["npc-occupation:artisan", "npc-background:folk-hero", "npc-theme:artisan"],
    ["npc-occupation:criminal", "npc-background:smuggler", "npc-theme:intrigue"],
    ["npc-occupation:criminal", "npc-background:noble", "npc-theme:intrigue"],
    ["npc-occupation:wilderness", "npc-background:folk-hero", "npc-theme:nature"],
    ["npc-occupation:artisan", "npc-background:folk-hero", "npc-theme:whimsical"],
    ["npc-occupation:artisan", "npc-background:noble", "npc-theme:artisan"],
    ["npc-occupation:wilderness", "npc-background:smuggler", "npc-theme:nature"],
    ["npc-occupation:scholar", "npc-background:noble", "npc-theme:intrigue"],
    ["npc-occupation:criminal", "npc-background:smuggler", "npc-theme:dark"],
    ["npc-occupation:artisan", "npc-background:folk-hero", "npc-theme:whimsical"],
    ["npc-occupation:scholar", "npc-background:folk-hero", "npc-theme:nature"],
    ["npc-occupation:wilderness", "npc-background:criminal", "npc-theme:nature"],
]

NAME_STYLE_TAGS = [
    "npc-name-style:rugged",     # Adrik Brightsun
    "npc-name-style:noble",      # Aurora Redthorn
    "npc-name-style:noble",      # Corwin Ashford
    "npc-name-style:devilish",   # Damaia Silverfrond
    "npc-name-style:whimsical",  # Eldon Merryweather
    "npc-name-style:noble",      # Jhessail Snowmantle
    "npc-name-style:rugged",     # Kathra Ironfist
    "npc-name-style:devilish",   # Morthos Gallows
    "npc-name-style:whimsical",  # Nissa Oakheart
    "npc-name-style:whimsical",  # Perrin Fairwind
    "npc-name-style:rugged",     # Rhogar Stormriver
    "npc-name-style:whimsical",  # Sybilwick Underbough
]


def entry_tags(slot: str, index: int) -> list[str]:
    """Give every curated NPC option useful, namespaced constraint metadata."""
    if slot == "name":
        return [NAME_STYLE_TAGS[index % len(NAME_STYLE_TAGS)]]
    if slot == "occupation":
        return OCCUPATION_TAGS[index % len(OCCUPATION_TAGS)]
    # Narrative attributes can respond to background and theme without making
    # unrelated constraints (such as name style) apply to them.
    backgrounds = NPC_FACETS["npc-background"]
    themes = NPC_FACETS["npc-theme"]
    return [
        f"npc-background:{backgrounds[index % len(backgrounds)]}",
        f"npc-theme:{themes[index % len(themes)]}",
    ]

# Real imported tables are preferred for the four attributes that have dependable DMG/XGE
# names.  The fallback entries also make a fresh, network-free install fully usable.
TABLES = [
    ("name", "NPC Name", None, [
        "Adrik Brightsun", "Aurora Redthorn", "Corwin Ashford", "Damaia Silverfrond",
        "Eldon Merryweather", "Jhessail Snowmantle", "Kathra Ironfist", "Morthos Gallows",
        "Nissa Oakheart", "Perrin Fairwind", "Rhogar Stormriver", "Sybilwick Underbough",
    ]),
    ("appearance", "NPC Appearance", ("NPC Appearance", "DMG"), [
        "A pronounced scar crosses one cheek", "Impeccably dressed despite the surroundings",
        "Unusual, mismatched eye colors", "Weathered skin and travel-stained hands",
        "Elaborate tattoos mark an old allegiance", "A rigid posture and unwavering stare",
        "A signature hat that never comes off", "Prematurely white hair",
    ]),
    ("occupation", "NPC Occupation", ("Supplemental Tables; Occupation", "XGE"), [
        "Blacksmith", "Dockhand", "Guard captain", "Herbalist", "Innkeeper", "Merchant",
        "Sailor", "Scholar", "Smuggler", "Street performer", "Temple attendant", "Tracker",
    ]),
    ("motivation", "NPC Motivation", ("Monsters and Motivations; Monster Motivation", "DMG"), [
        "Seeks redemption for an old betrayal", "Wants recognition from a dismissive rival",
        "Protects someone who cannot protect themself", "Needs money before a debt comes due",
        "Intends to expose a powerful liar", "Wants to escape the life others chose for them",
        "Searches for a missing loved one", "Craves a position of lasting influence",
    ]),
    ("secret", "NPC Secret", ("Flaw or Secret; NPC Flaws and Secrets", "DMG"), [
        "Is a spy for a rival faction", "Is living under a stolen identity",
        "Owes a life debt to a dangerous person", "Is slowly succumbing to a hidden curse",
        "Once betrayed a close friend", "Is being blackmailed over an old crime",
        "Practices a forbidden faith", "Witnessed a murder and remained silent",
    ]),
    ("alignment", "NPC Alignment", None, [
        "Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "Neutral",
        "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil",
    ]),
    ("ancestry", "NPC Ancestry", None, [
        "Dragonborn", "Dwarf", "Elf", "Gnome", "Goliath", "Halfling", "Human",
        "Orc", "Tiefling", "A mixed or uncertain heritage", "A rare local ancestry",
        "A lineage they deliberately keep secret",
    ]),
    ("age", "NPC Age", None, [
        "Very young for their people", "A young adult", "In the prime of adulthood",
        "Middle-aged", "Older, but still vigorous", "Elderly and experienced",
        "Appears much younger than they are", "Appears much older than they are",
    ]),
    ("attitude", "NPC Initial Attitude", None, [
        "Friendly and eager to help", "Warm, but clearly wants something", "Polite and guarded",
        "Distracted by an urgent problem", "Suspicious until trust is earned", "Openly impatient",
        "Frightened of the party", "Hostile, though willing to listen",
    ]),
    ("ideal", "NPC Ideal", None, [
        "Community: people survive by standing together", "Freedom: no one should decide another's path",
        "Tradition: inherited customs carry hard-won wisdom", "Knowledge: truth is worth any discomfort",
        "Power: influence is the surest form of safety", "Redemption: anyone can choose to become better",
        "Ambition: a life without achievement is wasted", "Balance: every extreme creates its own disaster",
    ]),
    ("bond", "NPC Bond", None, [
        "Will do anything to protect their family", "Owes everything to a patient mentor",
        "Cannot abandon their neighborhood in a crisis", "Guards a keepsake from someone they lost",
        "Is devoted to a temple, guild, or company", "Must repay a debt of honor",
        "Protects a secret shared with an old friend", "Intends to restore their disgraced family name",
    ]),
    ("personality", "NPC Personality Trait", None, [
        "Curious to a fault and unable to ignore a mystery", "Bluntly honest even when tact would help",
        "Meticulous and obsessed with small details", "Cheerful in the face of disaster",
        "Suspicious of strangers and slow to trust", "Generous to the point of self-neglect",
        "Calculating; weighs every word before speaking", "Loyal even to people who do not deserve it",
        "Overly formal in every situation", "Jokes whenever a conversation becomes tense",
    ]),
    ("pitfall", "NPC Flaw or Pitfall", None, [
        "Pride prevents them from asking for help", "Cannot resist a wager or risky challenge",
        "Assumes authority figures are always right", "Abandons good plans when impatient",
        "Keeps promises long after they become harmful", "Takes every criticism as a personal attack",
        "Spends money as quickly as it arrives", "Freezes when forced to choose between friends",
    ]),
    ("relationship", "NPC Relationship", None, [
        "Owes a life debt to another local NPC", "Has a bitter rivalry with someone in the same trade",
        "Secretly protects the child of an enemy", "Is estranged from a sibling who lives nearby",
        "Mentors someone who misunderstands their motives", "Is bound by an old oath they now regret",
        "Publicly admires, but privately despises, a guild peer", "Still searches for the stranger who once saved them",
    ]),
    ("history", "NPC History Hook", None, [
        "Survived a disaster that nobody else remembers the same way", "Inherited a map they believe is incomplete",
        "Was expelled from a respected order without explanation", "Returned home after years as a prisoner",
        "Accidentally became the keeper of a dangerous relic", "Was once celebrated for a deed that was actually a fraud",
        "Fled a community that now desperately needs their help", "Knows the truth behind a famous local legend",
    ]),
    ("voice", "NPC Voice & Mannerism", None, [
        "Speaks in a low whisper and maintains intense eye contact", "Uses elaborate metaphors, then explains each one",
        "Laughs once before answering any difficult question", "Never uses names, only titles and nicknames",
        "Talks rapidly while constantly rearranging nearby objects", "Pauses mid-sentence as if listening to someone unseen",
        "Drawls every word and taps a steady rhythm", "Answers questions with questions whenever nervous",
    ]),
]

NPC_EXPANSION = {
    "name": ["Brenna Coldwell", "Dara Larkspur", "Edrin Brightwater", "Faelivrin Everleaf", "Halden Hallow", "Marisol Fairwind", "Rosaline Silversong", "Thane Crag", "Vaelara Windriven", "Wynne Thistledown", "Drozgul Vraknor", "Ravenna Hexmoor"],
    "appearance": ["Braided hair threaded with copper wire", "One hand is covered by an ink-stained glove", "A practical coat has dozens of labeled pockets", "Their shadow seems a fraction too slow", "Old burn marks climb one forearm", "Always carries a fresh flower", "Wears spectacles with one dark lens", "Has the callused hands of a musician", "Keeps their face hidden behind a ceremonial veil", "Smells faintly of woodsmoke and mint", "A missing tooth flashes when they grin", "Their clothes have been expertly repaired many times"],
    "occupation": ["Beekeeper", "Cartographer", "Diplomatic aide", "Exorcist", "Ferrymaster", "Glassblower", "Gravekeeper", "Locksmith", "Midwife", "Monster anatomist", "Rat catcher", "Stage magician", "Tax collector", "Translator", "Veterinarian", "Wagonwright"],
    "motivation": ["Must keep an inherited oath", "Wants to prove a disputed discovery", "Needs to reunite a divided community", "Hopes to recover a stolen reputation", "Plans to buy someone's freedom", "Wants one last great adventure", "Seeks evidence that a prophecy is false", "Intends to preserve a vanishing craft", "Needs forgiveness but cannot ask directly", "Wants to replace a corrupt superior", "Searches for a place seen only in dreams", "Protects the public from a truth they consider dangerous"],
    "secret": ["Can read a supposedly lost language", "Has been forging official travel papers", "Receives instructions in their dreams", "Is heir to a title they publicly reject", "Shelters a harmless creature blamed for local attacks", "Knows the town's founding story is fabricated", "Has a second family under another name", "Cannot cross running water", "Accidentally caused the current crisis", "Possesses a key without knowing its lock", "Is immune to a threat everyone else fears", "Has promised the same treasure to two factions"],
    "alignment": ["Principled but skeptical of authority", "Compassionate, with little patience for rules", "Orderly and primarily self-interested", "Flexible, loyal to people over ideals", "Rebellious for the common good", "Cruel only when safely protected by law"],
    "ancestry": ["Aasimar", "Firbolg", "Goblin", "Hobgoblin", "Kenku", "Kobold", "Tabaxi", "Triton", "A magically altered lineage", "A planar visitor passing as local"],
    "age": ["Newly considered an adult", "Older than the settlement where they live", "At an age of major cultural responsibility", "Near retirement and resisting it", "Their age is magically uncertain", "Rejuvenated after living a full lifetime"],
    "attitude": ["Delighted by competent company", "Overfamiliar and quick to confide", "Businesslike and pressed for time", "Respectful but unwilling to bend protocol", "Amused by the party's reputation", "Embarrassed to need adventurers", "Quietly testing every claim", "Helpful only while carefully observed"],
    "ideal": ["Stewardship: power is borrowed from those affected by it", "Hospitality: shelter must be offered even to an enemy", "Craft: careful work outlives its maker", "Curiosity: unanswered questions are invitations", "Mercy: victory should leave room for change", "Memory: the forgotten deserve witnesses", "Pragmatism: a workable compromise beats a perfect failure", "Wonder: the world should remain capable of surprise"],
    "bond": ["Maintains a shrine no one else visits", "Promised to deliver a letter to an unknown recipient", "Raises the child of a former enemy", "Will not abandon an aging animal companion", "Protects the reputation of a dead teacher", "Keeps a failing family business alive", "Serves a community that distrusts them", "Must return a borrowed relic before the next eclipse"],
    "personality": ["Collects tiny facts about everyone they meet", "Treats every problem like a negotiation", "Apologizes to objects after bumping into them", "Finds genuine delight in other people's expertise", "Becomes intensely competitive over trivial games", "Never sits with their back to a door", "Uses silence to make others fill the gap", "Gives excellent advice they never follow", "Remembers faces perfectly but forgets names", "Turns any task into a small ceremony"],
    "pitfall": ["Mistakes secrecy for wisdom", "Cannot leave an insult unanswered", "Promises more than they can deliver", "Protects tradition even when it hurts people", "Trusts written proof over lived testimony", "Believes every kindness creates a debt", "Avoids conflict until it becomes a crisis", "Confuses being needed with being loved"],
    "relationship": ["Shares custody of a troublesome magical pet", "Competes with a cousin for an inheritance", "Exchanges anonymous letters with a political opponent", "Was raised by the person they now investigate", "Is the only friend of a widely disliked official", "Employs a former rival who knows too much", "Pretends not to know their famous parent", "Has a standing dinner date with a local ghost"],
    "history": ["Helped build a landmark that later became cursed", "Was the sole juror to oppose a famous verdict", "Spent a winter in a place absent from every map", "Once negotiated peace using forged authority", "Discovered a ruin and sold the credit to pay a debt", "Survived a shipwreck with an enemy who became a friend", "Carried messages during a war and still knows old codes", "Was declared dead and chose not to correct the record"],
    "voice": ["Speaks precisely, then adds a plain-language translation", "Counts points on their fingers while arguing", "Whistles softly before saying something untrue", "Uses nautical terms for ordinary situations", "Finishes other people's proverbs incorrectly", "Drops their accent when angry", "Addresses everyone as an old friend", "Tells short stories instead of giving direct answers"],
}
for _row in TABLES:
    _row[3].extend(NPC_EXPANSION.get(_row[0], []))


async def ensure_lookup_table(conn, category_id, format_id, display_name, preferred, entries, slot):
    row = None
    # These tables intentionally own their entries: unlike a sourced rulebook
    # table, every option can be tagged and safely constrained.
    if not row:
        row = await conn.fetchrow("SELECT id FROM random_tables WHERE name = $1 AND source_book = $2", display_name, SOURCE)
    if row:
        table_id = row["id"]
        await conn.execute("DELETE FROM table_columns WHERE table_id=$1", table_id)
        await conn.execute(
            "UPDATE random_tables SET description=$2,category_id=$3,format_id=$4,is_system=true WHERE id=$1",
            table_id, f"NPC Builder component: {display_name}.", category_id, format_id,
        )
    else:
        table_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO random_tables (id,name,description,category_id,format_id,source_book,is_system) VALUES ($1,$2,$3,$4,$5,$6,true)",
            table_id, display_name, f"NPC Builder component: {display_name}.", category_id, format_id, SOURCE,
        )
    column_id = uuid.uuid4()
    await conn.execute(
        "INSERT INTO table_columns (id,table_id,name,die_count,die_sides,sort_order) VALUES ($1,$2,'Result',1,$3,0)",
        column_id, table_id, len(entries),
    )
    for index, text in enumerate(entries, 1):
        await conn.execute(
            "INSERT INTO table_entries (id,column_id,min,max,kind,text,sort_order) VALUES ($1,$2,$3,$3,'text',$4,$3)",
            uuid.uuid4(), column_id, index, text,
        )

    tag_ids = {}
    for namespace, values in NPC_FACETS.items():
        for value in values:
            tag = await conn.fetchrow(
                "INSERT INTO tag (id,namespace,value,label,is_system) VALUES ($1,$2,$3,$4,true) "
                "ON CONFLICT (namespace,value) DO UPDATE SET label=EXCLUDED.label RETURNING id",
                uuid.uuid4(), namespace, value, value.replace("-", " ").title(),
            )
            tag_ids[f"{namespace}:{value}"] = tag["id"]
    rows = await conn.fetch(
        "SELECT e.id FROM table_entries e JOIN table_columns c ON c.id=e.column_id "
        "WHERE c.table_id=$1 ORDER BY e.sort_order, e.id",
        table_id,
    )
    # Re-running the seed is also a repair operation. Remove only this table's
    # NPC-facet assignments before applying the current curated classification;
    # unrelated user/authored tags remain untouched.
    await conn.execute(
        "DELETE FROM table_entry_tag et USING table_entries e, table_columns c, tag t "
        "WHERE et.entry_id=e.id AND e.column_id=c.id AND c.table_id=$1 "
        "AND et.tag_id=t.id AND t.namespace = ANY($2::text[])",
        table_id, list(NPC_FACETS),
    )
    for index, entry in enumerate(rows):
        for key in entry_tags(slot, index):
            await conn.execute(
                "INSERT INTO table_entry_tag (entry_id,tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
                entry["id"], tag_ids[key],
            )
    return table_id


async def seed_npc_builder(conn: asyncpg.Connection) -> None:
    category = await conn.fetchrow("SELECT id FROM category WHERE slug = 'npc-generation'")
    lookup = await conn.fetchrow("SELECT id FROM table_formats WHERE slug = 'lookup'")
    if not category or not lookup:
        raise RuntimeError("Run seed_random_tables_taxonomy.py before seeding the NPC Builder")

    table_ids = []
    for slot, name, preferred, entries in TABLES:
        table_ids.append((slot, await ensure_lookup_table(conn, category["id"], lookup["id"], name, preferred, entries, slot)))

    generator = await conn.fetchrow("SELECT id FROM generators WHERE slug = $1", GENERATOR_SLUG)
    if generator:
        generator_id = generator["id"]
        await conn.execute(
            "UPDATE generators SET name='NPC Builder', category_id=$2, description=$3, combine_template=$4, is_system=true WHERE id=$1",
            generator_id, category["id"], "Choose which NPC attribute tables to roll, then create a new NPC or enrich an existing one.", "{name}: {appearance} {occupation}; {alignment}. {motivation} {secret}",
        )
        await conn.execute("DELETE FROM generator_components WHERE generator_id=$1", generator_id)
    else:
        generator_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO generators (id,slug,name,category_id,description,combine_template,parameters,is_system) VALUES ($1,$2,'NPC Builder',$3,$4,$5,'[]'::jsonb,true)",
            generator_id, GENERATOR_SLUG, category["id"], "Choose which NPC attribute tables to roll, then create a new NPC or enrich an existing one.", "{name}: {appearance} {occupation}; {alignment}. {motivation} {secret}",
        )

    for order, (slot, table_id) in enumerate(table_ids):
        await conn.execute(
            "INSERT INTO generator_components (id,generator_id,table_id,output_slot,roll_count,optional,sort_order) VALUES ($1,$2,$3,$4,1,true,$5)",
            uuid.uuid4(), generator_id, table_id, slot, order,
        )
    print(f"generators: seeded/repaired {GENERATOR_SLUG} with {len(table_ids)} selectable tables")


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
            await seed_npc_builder(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
