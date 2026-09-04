"""Seed guided Social, Combat, and Exploration Encounter Builders.

Every component is an ordinary random table. Creature/NPC components are populated from
the real ``creatures`` table and use creature_ref/npc_ref entries exclusively: no creature
name is copied into entry text. Re-running this script repairs the system tables and
generators without duplicating them.
"""
from __future__ import annotations

import asyncio
import os
import uuid

import asyncpg


SOURCE = "WorldWatcher Encounter Builder"

FACETS = {
    "encounter-place": ["tavern", "court", "market", "wilderness", "road", "dungeon", "ruins", "temple", "coast", "planar"],
    "encounter-theme": ["intrigue", "horror", "heroic", "mystery", "survival", "war", "arcane", "divine"],
    "encounter-difficulty": ["easy", "medium", "hard", "deadly"],
}

SHARED = {
    "name": ("Encounter Title", [
        "A Debt Comes Due", "The Door That Should Be Closed", "Ashes Before Dawn", "A Knife in the Crowd",
        "The Price of Safe Passage", "Whispers Under Stone", "The Last Honest Warning", "Beneath a Broken Banner",
    ], "encounter-theme"),
    "hook": ("Encounter Hook", [
        "A frightened witness begs the party to intervene before anyone notices.",
        "A routine journey is interrupted by evidence that someone arrived first.",
        "An old promise is invoked at the worst possible moment.",
        "A valuable object changes hands in plain sight, and the wrong person sees it.",
        "The safest route suddenly becomes the most dangerous choice.",
        "A local authority offers help, but only if the party acts immediately.",
        "A familiar symbol reveals that this trouble is connected to an earlier threat.",
        "Someone the party trusts is found where they absolutely should not be.",
    ], "encounter-theme"),
    "read_aloud": ("Encounter Read Aloud", [
        "Conversation falters as every face turns toward you. Somewhere nearby, wood creaks under a weight it was never meant to bear.",
        "The air tastes of rain and iron. Fresh tracks cross your path, then vanish at the edge of the light.",
        "A bell sounds once. Doors close in sequence, and the last open window goes dark.",
        "Dust hangs motionless in the air. Beneath it, a thin line of blue light traces a pattern across the floor.",
        "The crowd parts without a word. At its center, someone is waiting with an offer already prepared.",
        "Salt wind carries a distant cry. The ground ahead is scattered with possessions, but there are no bodies.",
        "The ruin seems empty until a second set of footsteps begins matching your own.",
        "Warm light spills from the doorway, along with laughter that stops the instant you enter.",
        "A low vibration passes through the stone. Loose pebbles dance, settle, and begin to dance again.",
        "Incense and smoke blur the far end of the chamber, where a lone silhouette raises one hand for silence.",
    ], "encounter-place"),
    "reward": ("Encounter Reward", [
        "A useful local contact and a favor owed", "A concealed cache worth 100 gp", "Safe passage through hostile territory",
        "A clue pointing toward a larger threat", "A consumable magic item appropriate to the party", "Public gratitude and improved faction standing",
        "A map revealing a hidden route", "Leverage over an influential rival",
    ], None),
}

PILLARS = {
    "combat": {
        "objective": ("Combat Objective", ["Defeat the leader", "Survive until help arrives", "Protect a vulnerable target", "Reach the far exit", "Retrieve the marked object", "Break enemy morale", "Hold the chokepoint", "Capture the commander alive"], None),
        "complication": ("Combat Complication", ["Reinforcements arrive on round three", "The battlefield begins collapsing", "An innocent is trapped in the danger zone", "Visibility worsens each round", "A ritual completes unless interrupted", "The enemy offers a sudden parley", "Fire spreads across available cover", "The apparent leader is a decoy"], "encounter-difficulty"),
    },
    "social": {
        "objective": ("Social Objective", ["Win access to a restricted place", "Learn who is truly responsible", "Secure an alliance", "Prevent a public accusation", "Negotiate safe passage", "Convince a witness to speak", "Expose a lie without causing violence", "Trade for a vital resource"], None),
        "complication": ("Social Complication", ["A rival party interrupts", "The NPC recognizes one of the heroes", "An eavesdropper is discovered", "The offer expires at sunset", "A cultural taboo is accidentally tested", "A hidden agenda surfaces", "Someone produces convincing false evidence", "The conversation is being used as a distraction"], "encounter-difficulty"),
    },
    "exploration": {
        "objective": ("Exploration Objective", ["Find a safe route through", "Recover evidence without disturbing the site", "Reach the destination before conditions worsen", "Identify what changed the environment", "Cross without spending scarce resources", "Locate a hidden point of interest", "Disable the obstacle for those who follow", "Escape before the route seals"], None),
        "complication": ("Exploration Complication", ["Weather changes without warning", "The route splits the party", "A collapse blocks the return path", "Light and time become scarce", "A wandering creature is drawn near", "The obvious path is a convincing dead end", "Crossing costs a valuable resource", "The environment reacts to magic"], "encounter-difficulty"),
    },
}

# Original, system-owned expansion. Keeping these in the canonical builder seed
# makes a rerun both an install and a deterministic repair.
SHARED["name"][1].extend([
    "The Silence After Thunder", "Three Bells at Midnight", "The Unwelcome Procession",
    "Smoke on the Old Road", "A Crown Without an Heir", "The Lantern Below",
    "What the Flood Revealed", "The Guest Who Never Left", "Terms of Surrender",
    "Footprints in the Ceiling", "The Orchard Keeps Its Dead", "A Favor for a Stranger",
])
SHARED["hook"][1].extend([
    "A dying courier entrusts the party with a message addressed to an enemy.",
    "A harmless local custom suddenly produces an impossible result.",
    "Two credible witnesses give mutually exclusive accounts and both ask for protection.",
    "A monster offers information in exchange for sanctuary.",
    "A celebration is interrupted when every clock stops at once.",
    "A rival adventuring company returns with one member too many.",
    "A child has drawn a precise map of a place nobody admits exists.",
    "A routine inspection exposes a hidden room that was occupied moments ago.",
    "A public reward is posted for an act the party already performed in secret.",
    "An enemy requests a temporary truce against something worse.",
    "A deceased contact sends a newly written letter.",
    "The party's destination appears abandoned, but dinner is still warm.",
])
SHARED["read_aloud"][1].extend([
    "Rain needles the empty square. A trail of muddy footprints ends at a dry stone wall.",
    "Birdsong cuts off in a widening circle, followed by the snap of a distant branch.",
    "The bridge sways though the air is still, and something knocks from beneath its planks.",
    "A sweet smell masks smoke. Beyond the next rise, orange light pulses against the clouds.",
    "Every mirror in the room reflects the same open doorway, though no such door is present.",
    "A cheer rises ahead, becomes a scream, and then resolves into perfect silence.",
    "Cold mist spills down the stairs against the pull of gravity, carrying whispered names.",
    "The road marker has been turned around. Its fresh paint points in three directions at once.",
    "Coins lie scattered across the floor in a careful spiral around a single muddy boot.",
    "A horn answers from the valley, then a second sounds much closer than the first.",
])
SHARED["reward"][1].extend([
    "A legal pardon or writ of passage", "A safehouse stocked for one week",
    "The truthful answer to one guarded question", "A trained guide for the next journey",
    "A minor charm with three uses", "Ownership of a neglected but useful property",
    "An introduction to a secretive organization", "Recovery of a treasured personal keepsake",
    "A coded ledger exposing a smuggling route", "A blessing that aids one crucial check",
])

for _pillar, _objectives, _complications in [
    ("combat", ["Stop the escape", "Close three unstable portals", "Escort a noncombatant across the field", "Destroy the siege device", "Force a retreat without killing", "Prevent enemies from sounding the alarm", "Separate two allied threats", "Complete a rescue under fire"], ["Neutral creatures stampede through the fight", "Gravity shifts at initiative count 20", "The objective moves each round", "A third faction attacks both sides", "Defeated enemies rise once unless consecrated", "The floor floods one step deeper each round", "Weapons reveal hidden marks when bloodied", "A fragile treaty forbids certain tactics"]),
    ("social", ["Arrange an exchange of prisoners", "Learn the terms of a secret pact", "Turn two rivals against a common threat", "Obtain a confession before witnesses", "Calm a crowd before panic spreads", "Win formal recognition of a claim", "Recruit a reluctant specialist", "End a feud without humiliating either side"], ["The discussion must follow an unfamiliar ritual", "A magical oath prevents direct lies", "The most influential listener cannot speak", "A translation error changes the apparent offer", "The venue is closing for an emergency", "One participant has mistaken a hero for someone else", "Success would harm an absent ally", "The negotiator's superior secretly wants talks to fail"]),
    ("exploration", ["Chart a route others can safely follow", "Find shelter before a supernatural storm", "Recover samples without contamination", "Determine which landmark is an illusion", "Follow a trail that changes with the moon", "Restore an ancient navigation device", "Locate survivors before their air runs out", "Reach the center without waking the site"], ["Distances change whenever the party rests", "Maps become inaccurate after each junction", "A helpful guide is slowly being possessed", "The safest terrain erases recent memories", "Local wildlife imitates the party's voices", "Each spell cast attracts a visible omen", "The destination is moving", "A previous expedition left deliberately misleading signs"]),
]:
    PILLARS[_pillar]["objective"][1].extend(_objectives)
    PILLARS[_pillar]["complication"][1].extend(_complications)


def cr_number(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        if "/" in value:
            top, bottom = value.split("/", 1)
            return float(top) / float(bottom)
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        return 0.0


def difficulty_for_cr(value: str | None) -> str:
    cr = cr_number(value)
    if cr <= 0.5:
        return "easy"
    if cr <= 3:
        return "medium"
    if cr <= 8:
        return "hard"
    return "deadly"


async def ensure_tags(conn: asyncpg.Connection) -> dict[str, uuid.UUID]:
    ids: dict[str, uuid.UUID] = {}
    for namespace, values in FACETS.items():
        for value in values:
            row = await conn.fetchrow(
                "INSERT INTO tag (id,namespace,value,label,is_system) VALUES ($1,$2,$3,$4,true) "
                "ON CONFLICT (namespace,value) DO UPDATE SET label=EXCLUDED.label RETURNING id",
                uuid.uuid4(), namespace, value, value.replace("-", " ").title(),
            )
            ids[f"{namespace}:{value}"] = row["id"]
    return ids


async def replace_text_table(conn, category_id, format_id, tag_ids, pillar, slot, definition):
    name, entries, namespace = definition
    stored_name = f"{pillar.title()} Builder — {name}"
    row = await conn.fetchrow("SELECT id FROM random_tables WHERE name=$1 AND source_book=$2", stored_name, SOURCE)
    table_id = row["id"] if row else uuid.uuid4()
    if row:
        await conn.execute("DELETE FROM table_columns WHERE table_id=$1", table_id)
        await conn.execute("UPDATE random_tables SET description=$2,category_id=$3,format_id=$4,is_system=true WHERE id=$1", table_id, f"{pillar.title()} Encounter Builder component: {name}.", category_id, format_id)
    else:
        await conn.execute("INSERT INTO random_tables (id,name,description,category_id,format_id,source_book,is_system) VALUES ($1,$2,$3,$4,$5,$6,true)", table_id, stored_name, f"{pillar.title()} Encounter Builder component: {name}.", category_id, format_id, SOURCE)
    column_id = uuid.uuid4()
    await conn.execute("INSERT INTO table_columns (id,table_id,name,die_count,die_sides,sort_order) VALUES ($1,$2,'Result',1,$3,0)", column_id, table_id, len(entries))
    for index, text in enumerate(entries, 1):
        entry_id = uuid.uuid4()
        await conn.execute("INSERT INTO table_entries (id,column_id,min,max,kind,text,sort_order) VALUES ($1,$2,$3,$3,'text',$4,$3)", entry_id, column_id, index, text)
        if namespace:
            values = FACETS[namespace]
            value = values[(index - 1) % len(values)]
            await conn.execute("INSERT INTO table_entry_tag (entry_id,tag_id) VALUES ($1,$2)", entry_id, tag_ids[f"{namespace}:{value}"])
    return slot, table_id


async def replace_actor_table(conn, category_id, format_id, tag_ids, pillar):
    is_social = pillar == "social"
    stored_name = f"{pillar.title()} Builder — {'NPC' if is_social else 'Creature'}"
    row = await conn.fetchrow("SELECT id FROM random_tables WHERE name=$1 AND source_book=$2", stored_name, SOURCE)
    table_id = row["id"] if row else uuid.uuid4()
    if row:
        await conn.execute("DELETE FROM table_columns WHERE table_id=$1", table_id)
        await conn.execute("UPDATE random_tables SET category_id=$2,format_id=$3,is_system=true WHERE id=$1", table_id, category_id, format_id)
    else:
        await conn.execute("INSERT INTO random_tables (id,name,description,category_id,format_id,source_book,is_system) VALUES ($1,$2,$3,$4,$5,$6,true)", table_id, stored_name, "Rolls a directly linked creature card; names are never stored as entry text.", category_id, format_id, SOURCE)
    creatures = await conn.fetch(
        "SELECT id,challenge_rating_display FROM creatures WHERE category=$1 ORDER BY name LIMIT 500",
        "npc" if is_social else "monster",
    )
    if not creatures and is_social:
        creatures = await conn.fetch("SELECT id,challenge_rating_display FROM creatures ORDER BY name LIMIT 500")
    column_id = uuid.uuid4()
    await conn.execute("INSERT INTO table_columns (id,table_id,name,die_count,die_sides,sort_order) VALUES ($1,$2,$3,1,$4,0)", column_id, table_id, "NPC" if is_social else "Creature", max(1, len(creatures)))
    for index, creature in enumerate(creatures, 1):
        entry_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO table_entries (id,column_id,min,max,kind,creature_id,npc_id,sort_order) VALUES ($1,$2,$3,$3,$4,$5,$6,$3)",
            entry_id, column_id, index, "npc_ref" if is_social else "creature_ref",
            None if is_social else creature["id"], creature["id"] if is_social else None,
        )
        difficulties = FACETS["encounter-difficulty"] if is_social else [difficulty_for_cr(creature["challenge_rating_display"])]
        for difficulty in difficulties:
            await conn.execute("INSERT INTO table_entry_tag (entry_id,tag_id) VALUES ($1,$2)", entry_id, tag_ids[f"encounter-difficulty:{difficulty}"])
    return "actor" if is_social else "creature", table_id


async def seed_encounter_builders(conn: asyncpg.Connection) -> None:
    lookup = await conn.fetchrow("SELECT id FROM table_formats WHERE slug='lookup'")
    if not lookup:
        raise RuntimeError("Run seed_random_tables_taxonomy.py first")
    tag_ids = await ensure_tags(conn)
    for pillar, specific in PILLARS.items():
        category = await conn.fetchrow("SELECT id FROM category WHERE slug=$1", f"encounters-{pillar}")
        if not category:
            raise RuntimeError("Run seed_random_tables_taxonomy.py first")
        components = []
        for slot, definition in {**SHARED, **specific}.items():
            components.append(await replace_text_table(conn, category["id"], lookup["id"], tag_ids, pillar, slot, definition))
        components.append(await replace_actor_table(conn, category["id"], lookup["id"], tag_ids, pillar))

        slug = f"{pillar}-encounter-builder"
        generator = await conn.fetchrow("SELECT id FROM generators WHERE slug=$1", slug)
        generator_id = generator["id"] if generator else uuid.uuid4()
        description = f"Choose {pillar}-specific framing, roll linked tables, preview, and add one complete encounter."
        if generator:
            await conn.execute("UPDATE generators SET name=$2,category_id=$3,description=$4,is_system=true WHERE id=$1", generator_id, f"{pillar.title()} Encounter Builder", category["id"], description)
            await conn.execute("DELETE FROM generator_components WHERE generator_id=$1", generator_id)
        else:
            await conn.execute("INSERT INTO generators (id,slug,name,category_id,description,combine_template,parameters,is_system) VALUES ($1,$2,$3,$4,$5,'','[]'::jsonb,true)", generator_id, slug, f"{pillar.title()} Encounter Builder", category["id"], description)
        for order, (slot, table_id) in enumerate(components):
            await conn.execute("INSERT INTO generator_components (id,generator_id,table_id,output_slot,roll_count,optional,sort_order) VALUES ($1,$2,$3,$4,1,true,$5)", uuid.uuid4(), generator_id, table_id, slot, order)
        print(f"generators: seeded/repaired {slug} with {len(components)} tables")


async def main() -> None:
    conn = await asyncpg.connect(
        host=os.environ.get("WW_DB_HOST", "localhost"), port=int(os.environ.get("WW_DB_PORT", "5432")),
        database=os.environ.get("WW_DB_NAME", "WorldWatcher_DB"), user=os.environ.get("WW_DB_USER", "postgres"),
        password=os.environ.get("WW_DB_PASSWORD", ""),
    )
    try:
        async with conn.transaction():
            await seed_encounter_builders(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
