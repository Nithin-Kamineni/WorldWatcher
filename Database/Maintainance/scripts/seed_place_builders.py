"""Seed four guided Place Builders and their independently rollable tables.

Re-runnable and network-free.  The data is deliberately compact starter taxonomy: the
tables are normal Random Tables, so a DM can inspect, clone, and expand them later.
"""
from __future__ import annotations

import asyncio
import os
import uuid

import asyncpg

SOURCE = "WorldWatcher Place Builder"

FACETS = {
    "country": {
        "place-country-government": ["monarchy", "council", "republic", "theocracy", "unusual"],
        "place-country-character": ["cosmopolitan", "traditional", "militaristic", "mystical", "mercantile"],
        "place-country-climate": ["temperate", "arid", "cold", "tropical", "otherworldly"],
        "place-country-power": ["fragile", "regional", "formidable", "declining", "rising"],
    },
    "settlement": {
        "place-settlement-size": ["hamlet", "village", "town", "city", "metropolis"],
        "place-settlement-character": ["orderly", "rough", "ancient", "verdant", "mystical"],
        "place-settlement-economy": ["agrarian", "industrial", "trade", "maritime", "arcane"],
        "place-settlement-tone": ["welcoming", "tense", "prosperous", "mysterious", "desperate"],
    },
    "building": {
        "place-building-type": ["commerce", "residence", "civic", "religious", "military", "leisure", "landmark"],
        "place-building-condition": ["pristine", "maintained", "weathered", "damaged", "ruined"],
        "place-building-tone": ["welcoming", "exclusive", "busy", "ominous", "secretive"],
        "place-building-scale": ["tiny", "modest", "large", "grand", "sprawling"],
    },
    "dungeon": {
        "place-dungeon-origin": ["natural", "religious", "military", "arcane", "funerary"],
        "place-dungeon-environment": ["subterranean", "urban", "wilderness", "aquatic", "planar"],
        "place-dungeon-danger": ["low", "moderate", "high", "deadly", "mythic"],
        "place-dungeon-theme": ["horror", "mystery", "war", "nature", "cosmic"],
    },
}

# type -> (article field/output slot, display name, entries, optional taxonomy namespace)
TABLES = {
    "country": [
        ("name", "Country Name", ["Alderreach", "Veyrun", "The Brass Concord", "Namarra", "Kestrel Crown", "Ossandria", "The Pale Marches", "Thornmere", "Caldris", "Ilyrion"], None),
        ("government", "Country Government", ["Hereditary monarchy", "Council of provinces", "Elected republic", "Temple hierarchy", "Rule by prophetic lottery"], "place-country-government"),
        ("culture", "Country Culture", ["Cosmopolitan crossroads", "Deeply traditional clans", "Honor-bound martial society", "Mysticism shapes daily life", "Merchant families set fashion and law"], "place-country-character"),
        ("territories", "Country Terrain", ["Temperate river valleys", "Arid mesas and salt flats", "Cold fjords and pine highlands", "Tropical islands and rainforests", "Floating provinces beneath an aurora"], "place-country-climate"),
        ("militaryStrength", "Country Power", ["A fragile levy and aging forts", "A capable regional army", "A formidable professional military", "A famous force in slow decline", "A rapidly rising naval power"], "place-country-power"),
        ("ruler", "Country Ruler", ["A young queen with veteran advisers", "A rotating council speaker", "A beloved former general", "An austere high hierophant", "An unseen sovereign issuing sealed decrees", "Twin heirs sharing an uneasy throne"], None),
        ("capital", "Country Capital", ["Highmere", "Crownfall", "Sablegate", "Lantern Bay", "Saint Orra", "Vellum", "Red Harbor", "The City of Nine Bridges"], None),
        ("population", "Country Population", ["180000", "420000", "900000", "1600000", "2800000", "5100000", "9400000"], None),
        ("currency", "Country Currency", ["Silver crowns", "Stamped trade bars", "Sun-faced gold royals", "Ceramic temple chits", "Iron marks", "Glass crescents"], None),
        ("currentConflict", "Country Current Conflict", ["A disputed succession divides the court", "Border lords are testing an old treaty", "A vital harvest has failed", "The capital and provinces contest new taxes", "A forbidden faith is spreading", "An overseas colony has declared independence"], None),
    ],
    "settlement": [
        ("name", "Settlement Name", ["Briar Hollow", "Dunmere", "Emberwick", "Foxbridge", "Gullwatch", "Harrowgate", "Mossbarrow", "Northpass", "Silverwell", "Wyrmford"], None),
        ("settlementType", "Settlement Size", ["Hamlet", "Village", "Town", "City", "Metropolis"], "place-settlement-size"),
        ("definingTrait", "Settlement Character", ["Immaculate streets and strict routines", "Mud, smoke, and loud workshops", "Ancient ruins rise between newer homes", "Gardens and green roofs cover every quarter", "Every doorway bears a protective charm"], "place-settlement-character"),
        ("economicSources", "Settlement Economy", ["Farms, orchards, and livestock", "Forges, mills, and workshops", "Caravan trade and tolls", "Fishing, shipbuilding, and naval trade", "Arcane education and enchanted crafts"], "place-settlement-economy"),
        ("overallTone", "Settlement Tone", ["Friendly and quick to include strangers", "Polite, watchful, and close to violence", "Confident after years of prosperity", "Quietly full of unanswered questions", "Exhausted by a crisis that will not end"], "place-settlement-tone"),
        ("population", "Settlement Population", ["85", "340", "1200", "4800", "17000", "64000", "210000"], None),
        ("government", "Settlement Government", ["Elected reeve and public moot", "Merchant council", "Hereditary lord", "Temple-appointed magistrate", "Guild coalition", "Military governor"], None),
        ("rulerOwner", "Settlement Ruler", ["A practical mayor popular with laborers", "A noble house with dwindling wealth", "Three rival guildmasters", "A retired adventurer", "An apparently ageless priest", "A governor newly arrived from the capital"], None),
        ("claimToFame", "Settlement Claim to Fame", ["A spectacular seasonal festival", "The finest blades in the region", "A university with a forbidden archive", "Food travelers cross borders to taste", "An undefeated arena champion", "A miracle-working public spring"], None),
        ("currentCalamity", "Settlement Calamity", ["Monster attacks have closed the roads", "A guild feud is turning violent", "The wells are slowly failing", "A scandal threatens the ruling family", "People vanish during the night watch", "An army is gathering beyond the walls"], None),
        ("rumorsAndHooks", "Settlement Rumor or Hook", ["A sealed vault beneath the square has begun to knock", "A missing caravan carried something the ruler fears", "Someone pays children for maps of the drains", "The festival relic is an excellent forgery", "A wanted outlaw lives here under a respected name", "Every stray animal disappeared on the same night"], None),
    ],
    "building": [
        ("name", "Building Name", ["The Copper Kettle", "Blackthorn House", "The Seven Lamps", "Gannet Hall", "The Crooked Crown", "Saint Veyra's Rest", "Moonwell Exchange", "The Red Door", "Ashlar House", "The Quiet Bell"], None),
        ("buildingType", "Building Type", ["Shop", "Tavern", "Inn", "Noble house", "Noble mansion", "Market", "Landmark", "Park", "Hospital", "Fire station", "Guard post", "Funeral house", "Temple", "Cathedral", "Church", "Barracks", "Guildhall", "Library", "School", "University", "Theater", "Bathhouse", "Warehouse", "Mill", "Forge", "Prison", "Courthouse", "Town hall", "Embassy", "Stables", "Orphanage", "Watchtower", "Lighthouse", "Monastery", "Casino"], "place-building-type"),
        ("condition", "Building Condition", ["Pristine and newly finished", "Well maintained", "Weathered but sound", "Damaged and partly closed", "Ruined, with a few usable rooms"], "place-building-condition"),
        ("atmosphere", "Building Atmosphere", ["Warm and welcoming", "Exclusive and formal", "Busy at nearly every hour", "Ominous despite ordinary activity", "Secretive, with guarded side rooms"], "place-building-tone"),
        ("scale", "Building Scale", ["Tiny single-room establishment", "Modest neighborhood building", "Large multi-wing structure", "Grand and richly appointed", "Sprawling complex with courtyards"], "place-building-scale"),
        ("floors", "Number of Floors", ["1", "2", "3", "4", "5", "6", "8", "12"], None),
        ("owner", "Building Owner", ["A cheerful family partnership", "An exacting guild artisan", "A minor noble with major debts", "A retired soldier", "A soft-spoken priest", "An absentee merchant consortium", "A masked proprietor", "The city itself"], None),
        ("purpose", "Building Purpose", ["Serves locals at fair prices", "Caters to wealthy visitors", "Provides a vital civic service", "Acts as a front for illicit business", "Preserves a fading tradition", "Supports a powerful local faction"], None),
        ("notableFeatures", "Building Feature", ["A stained-glass ceiling changes with the weather", "A hidden cellar predates the street", "A vast central hearth never goes out", "The doors bear hundreds of carved names", "A rooftop garden overlooks the district", "An ingenious lift joins the upper floors", "A shrine occupies an unexpected corner", "One room has no visible entrance"], None),
        ("secret", "Building Secret", ["The owner shelters a wanted fugitive", "A forgotten tunnel links it to the civic quarter", "Its deed was won through a dangerous bargain", "One employee reports to a rival faction", "Something wakes beneath it after midnight", "The public business conceals a private auction house"], None),
    ],
    "dungeon": [
        ("name", "Dungeon Name", ["The Hollow Crown", "Ashvault", "The Drowned Archive", "Gallowsdeep", "The Sepulcher of Glass", "Red Maw Delve", "The Silent Engine", "Thornfast Below", "Vault of the Last Oath", "The Weeping Labyrinth"], None),
        ("origin", "Dungeon Origin", ["A natural cavern enlarged by burrowing beasts", "A temple sealed after a failed rite", "A fortress abandoned after a siege", "A laboratory built around a planar breach", "A royal necropolis whose guardians remain"], "place-dungeon-origin"),
        ("dungeonEnvironment", "Dungeon Environment", ["Deep subterranean passages", "Catacombs beneath a living city", "Overgrown ruins in trackless wilds", "Flooded chambers beneath dark water", "A fractured pocket dimension"], "place-dungeon-environment"),
        ("danger", "Dungeon Danger", ["Low danger suited to novice explorers", "Moderate danger with recoverable retreats", "High danger requiring careful preparation", "Deadly opposition and unforgiving hazards", "Mythic danger capable of changing the realm"], "place-dungeon-danger"),
        ("dungeonTheme", "Dungeon Theme", ["Claustrophobic horror", "A layered historical mystery", "The scars of an ancient war", "Nature reclaiming crafted halls", "Impossible geometry and cosmic influence"], "place-dungeon-theme"),
        ("purpose", "Dungeon Purpose", ["Treasure vault", "Prison for a supernatural threat", "Tomb and memorial complex", "Military stronghold", "Mine that broke into older depths", "Pilgrimage site", "Arcane research facility"], None),
        ("statesOfRuin", "Dungeon State of Ruin", ["Perilous and prone to collapse", "Crumbling, rubble-choked halls", "Neglected and overgrown with hazards", "Abandoned and eerily silent", "Secure, locked, and trapped", "Thriving with hostile inhabitants"], None),
        ("inhabitants", "Dungeon Inhabitants", ["A disciplined kobold clan", "Undead repeating their final duties", "Cultists and a summoned guardian", "Fungal creatures linked by one mind", "Mercenaries seeking the same prize", "Constructs obeying obsolete commands", "Two monster factions at war"], None),
        ("notableFeatures", "Dungeon Feature", ["A flooded lower level hides a second entrance", "A vertical shaft connects every tier", "Murals change when no one watches", "A bridge crosses a bottomless illuminated gulf", "Roots have split the oldest chambers", "A broken machine still controls doors and light", "Time passes differently in the innermost vault"], None),
        ("treasure", "Dungeon Treasure", ["A relic claimed by two faiths", "The lost treasury of a minor kingdom", "A map to a more dangerous site", "A dormant intelligent weapon", "Proof that rewrites accepted history", "A hoard guarded by an inconvenient oath"], None),
        ("hook", "Dungeon Adventure Hook", ["A survivor returned carrying someone else's memories", "A patron needs one object recovered intact", "Creatures fleeing the dungeon threaten nearby roads", "A rival expedition entered yesterday", "The entrance opens for only three nights", "A local heir vanished while seeking family proof"], None),
    ],
}

# Additional original options for every guided builder. These deliberately focus on
# combinations that imply play: tensions, secrets, usable landmarks, and immediate hooks.
PLACE_EXPANSION = {
    ("country", "name"): ["Amberfall", "The River Compact", "Skeld", "Valecross", "Mournhaven", "The Isles of Orin"],
    ("country", "government"): ["Confederation of rival city-states", "Bureaucracy governed by civil examinations", "Dual crown shared by secular and sacred rulers", "Assembly chosen by land-owning guilds", "Military protectorate awaiting civilian rule"],
    ("country", "culture"): ["Hospitality is treated as sacred law", "Public debate is the favored entertainment", "Ancestors are consulted through household shrines", "Craft guilds define status and identity", "Seasonal migration shapes every institution"],
    ("country", "territories"): ["Vast grasslands broken by granite ridges", "Mist-filled wetlands and blackwater rivers", "Volcanic uplands surrounding a fertile basin", "A chain of fortified coastal peninsulas", "High plateaus cut by impossible canyons"],
    ("country", "militaryStrength"): ["Numerous local militias with no unified command", "Small elite force supported by powerful allies", "Strong fortifications but little field experience", "Veteran army exhausted by a recent war", "Dominant cavalry supported by weak logistics"],
    ("country", "ruler"): ["A reformer constrained by an ancient charter", "A council whose missing seventh seat still votes", "A conqueror trying to become a legitimate monarch", "A child sovereign represented by competing regents", "An elected ruler nearing an impossible term limit"],
    ("country", "capital"): ["Ambercourt", "Dawnbridge", "Greyhaven", "Orison", "Kingswater", "The Terraced City"],
    ("country", "population"): ["75000", "260000", "720000", "3400000", "12800000"],
    ("country", "currency"): ["Copper wheels pierced at the center", "Silver river-marks accepted by weight", "Paired half-coins broken for contracts", "Cloth notes backed by grain reserves", "Foreign coins counterstamped by the crown"],
    ("country", "currentConflict"): ["Two provinces claim the same newly discovered mine", "A popular reform violates an international oath", "Refugees are testing the border's capacity", "The navy and army support different heirs", "A magical resource is failing without explanation"],
    ("settlement", "name"): ["Ashcombe", "Bellwater", "Crow's Rest", "Greenbarrow", "Larkgate", "Westmere"],
    ("settlement", "settlementType"): ["Seasonal camp", "Fortified crossroads", "Mining borough", "Pilgrimage center", "Canal city"],
    ("settlement", "definingTrait"): ["Bridges connect homes built above a marsh", "Every trade advertises with a distinctive bell", "The old city lies intact beneath the new one", "Public gardens occupy the former fortifications", "Buildings are painted to record family history"],
    ("settlement", "economicSources"): ["Quarrying and stone carving", "Pilgrimage lodging and religious crafts", "Horse breeding and overland transport", "Paper mills and printing", "Medicinal plants gathered from nearby wetlands"],
    ("settlement", "overallTone"): ["Proud after surviving a recent disaster", "Energetic and rapidly outgrowing its walls", "Hospitable but divided by old loyalties", "Wealthy on the surface and deeply indebted", "Orderly during daylight and lawless after dusk"],
    ("settlement", "population"): ["24", "650", "2600", "9300", "38000", "125000"],
    ("settlement", "government"): ["Public lottery for short civic terms", "Council of neighborhood elders", "Judge appointed by a distant ruler", "Two co-mayors representing old and new districts", "Open assembly manipulated by skilled speakers"],
    ("settlement", "rulerOwner"): ["A former smuggler determined to govern honestly", "An efficient bureaucrat with no local allies", "A charismatic priest losing their faith", "A council chaired by its quietest member", "A hereditary ruler who secretly wants an election"],
    ("settlement", "claimToFame"): ["A bridge constructed from one piece of stone", "A market where no spoken bargaining is allowed", "The region's most accurate clock", "A choir said to calm storms", "A library of ordinary people's diaries"],
    ("settlement", "currentCalamity"): ["A sinkhole is spreading beneath the oldest district", "Counterfeit currency has paralyzed trade", "An admired official vanished with the public treasury", "A magical silence expands each night", "Two visiting delegations have brought their feud"],
    ("settlement", "rumorsAndHooks"): ["The new statue resembles someone buried centuries ago", "A cellar door opens onto a different building each dawn", "The night watch is receiving orders in a dead captain's handwriting", "A valuable caravan is hiding among ordinary refugees", "The river has begun returning objects lost years ago"],
    ("building", "name"): ["The Blue Thimble", "Foxglove Hall", "The Last Candle", "Nine Oaks", "The Brass Window", "The Pilgrim's Table"],
    ("building", "buildingType"): ["Observatory", "Printing house", "Museum", "Courier office", "Public kitchen", "Auction hall", "Scriptorium", "Menagerie"],
    ("building", "condition"): ["Newly repaired with mismatched materials", "Sound but visibly settling", "Beautiful facade hiding unsafe interiors", "Half restored while still occupied", "Magically preserved beyond its surroundings"],
    ("building", "atmosphere"): ["Quietly efficient", "Cluttered and intensely personal", "Ceremonial even during routine business", "Cheerful but under obvious surveillance", "Understaffed and close to panic"],
    ("building", "scale"): ["Narrow tower with stacked rooms", "Low complex around one courtyard", "Converted residence with awkward additions", "Monumental hall divided by temporary walls", "Underground rooms larger than the visible structure"],
    ("building", "floors"): ["Half-basement", "1 plus cellar", "2 plus attic", "3 plus rooftop terrace", "7", "10"],
    ("building", "owner"): ["A cooperative of current employees", "A celebrated artisan nearing retirement", "Two former spouses who refuse to sell", "A foreign investor represented by an anxious agent", "A charitable trust with missing records"],
    ("building", "purpose"): ["Trains apprentices in a scarce trade", "Stores emergency supplies for the district", "Hosts neutral meetings between rival groups", "Processes goods arriving from the countryside", "Maintains a service everyone uses but nobody values"],
    ("building", "notableFeatures"): ["Interior windows overlook rooms that no longer exist", "A speaking tube connects every floor", "The central staircase was built around a living tree", "Rainwater powers a web of small machines", "A public notice board conceals an older mosaic"],
    ("building", "secret"): ["Its foundations cross an unregistered property line", "The staff are quietly protecting the true owner", "A sealed room contains records that could ruin a guild", "The building is slowly becoming sentient", "A mundane business funds a heroic vigilante"],
    ("dungeon", "name"): ["Below Blackglass Hill", "The Clockless Vault", "Ember Sepulcher", "The Ninth Descent", "Saint's Folly", "The Unfinished Palace"],
    ("dungeon", "origin"): ["A civic water system expanded into forbidden depths", "A prison built to hold one unnamed captive", "A mine converted into a wartime refuge", "A vanished culture's astronomical observatory", "A monster's fossilized internal passages"],
    ("dungeon", "dungeonEnvironment"): ["Crystal caverns beneath a glacier", "Vertical ruins inside a canyon wall", "A buried district preserved in clay", "Tunnels grown from colossal roots", "Chambers drifting through the Astral Sea"],
    ("dungeon", "danger"): ["Deceptively safe until a clear boundary", "Danger that escalates with noise", "Few threats but no reliable retreat", "Lethal to the unprepared, fair to the observant", "Threats tailored by an intelligent overseer"],
    ("dungeon", "dungeonTheme"): ["Broken promises made physically manifest", "Competing expeditions and dwindling time", "Sacred duty corrupted by bureaucracy", "Memory, identity, and unreliable records", "Beauty maintained by terrible sacrifice"],
    ("dungeon", "purpose"): ["Observatory tracking planar conjunctions", "Repository for dangerous legal contracts", "Factory that produced magical servants", "Refuge designed to outlast an apocalypse", "Court where supernatural disputes were judged"],
    ("dungeon", "statesOfRuin"): ["Recently breached after centuries sealed", "Repeatedly repaired by different occupants", "Partly petrified by a magical accident", "Structurally sound but stripped of useful material", "Rebuilding itself according to obsolete plans"],
    ("dungeon", "inhabitants"): ["Descendants of the original maintenance crew", "Treasure hunters trapped by their own sabotage", "A scholarly expedition hiding a discovery", "Predators trained by an absent master", "Refugees negotiating with the dungeon's guardians"],
    ("dungeon", "notableFeatures"): ["A central map updates when doors open", "Every level has a different direction of gravity", "Messages can be sent through the plumbing", "One corridor passes through several seasons", "A vast pendulum opens and closes routes"],
    ("dungeon", "treasure"): ["A portable doorway keyed to three forgotten sites", "An archive of debts owed by immortal beings", "Seeds from plants extinct on this plane", "A crown that proves an inconvenient succession", "Tools capable of repairing a legendary artifact"],
    ("dungeon", "hook"): ["The dungeon has begun sending polite invitations", "A map shows a room matching the party's current camp", "Someone emerged claiming only an hour passed inside", "A sealed entrance now stands open after every storm", "The site's guardians request an independent mediator"],
}
for _place_type, _tables in TABLES.items():
    for _row in _tables:
        _row[2].extend(PLACE_EXPANSION.get((_place_type, _row[0]), []))

CATEGORY_SLUG = {"country": "countries", "settlement": "settlements", "building": "buildings", "dungeon": "dungeons"}

BUILDING_TYPE_FAMILIES = {
    "commerce": {"Shop", "Tavern", "Inn", "Market", "Guildhall", "Warehouse", "Mill", "Forge", "Stables"},
    "residence": {"Noble house", "Noble mansion", "Orphanage"},
    "civic": {"Park", "Hospital", "Fire station", "Funeral house", "Library", "School", "University", "Prison", "Courthouse", "Town hall", "Embassy"},
    "religious": {"Temple", "Cathedral", "Church", "Monastery"},
    "military": {"Guard post", "Barracks", "Watchtower"},
    "leisure": {"Theater", "Bathhouse", "Casino"},
    "landmark": {"Landmark", "Lighthouse"},
}


def facet_value(place_type, slot, text, namespace, index):
    if place_type == "building" and slot == "buildingType":
        return next((family for family, members in BUILDING_TYPE_FAMILIES.items() if text in members), "civic")
    values = FACETS[place_type].get(namespace, [])
    return values[(index - 1) % len(values)] if values else None


async def ensure_category(conn, place_type: str):
    parent = await conn.fetchrow("SELECT id FROM category WHERE slug='locations-settlements'")
    if not parent:
        raise RuntimeError("Run seed_random_tables_taxonomy.py first")
    slug = CATEGORY_SLUG[place_type]
    row = await conn.fetchrow("SELECT id FROM category WHERE slug=$1", slug)
    if row:
        return row["id"]
    category_id = uuid.uuid4()
    await conn.execute(
        "INSERT INTO category (id,parent_id,slug,name,is_system,sort_order) VALUES ($1,$2,$3,$4,true,0)",
        category_id, parent["id"], slug, "Countries" if place_type == "country" else place_type.title() + "s",
    )
    return category_id


async def ensure_tags(conn):
    ids = {}
    for groups in FACETS.values():
        for namespace, values in groups.items():
            for value in values:
                row = await conn.fetchrow(
                    "INSERT INTO tag (id,namespace,value,label,is_system) VALUES ($1,$2,$3,$4,true) "
                    "ON CONFLICT (namespace,value) DO UPDATE SET label=EXCLUDED.label RETURNING id",
                    uuid.uuid4(), namespace, value, value.replace("-", " ").title(),
                )
                ids[f"{namespace}:{value}"] = row["id"]
    return ids


async def seed_place_builders(conn):
    lookup = await conn.fetchrow("SELECT id FROM table_formats WHERE slug='lookup'")
    if not lookup:
        raise RuntimeError("Run seed_random_tables_taxonomy.py first")
    tag_ids = await ensure_tags(conn)
    for place_type, tables in TABLES.items():
        category_id = await ensure_category(conn, place_type)
        components = []
        for slot, name, entries, namespace in tables:
            row = await conn.fetchrow("SELECT id FROM random_tables WHERE name=$1 AND source_book=$2", name, SOURCE)
            table_id = row["id"] if row else uuid.uuid4()
            if row:
                await conn.execute("DELETE FROM table_columns WHERE table_id=$1", table_id)
                await conn.execute("UPDATE random_tables SET description=$2,category_id=$3,format_id=$4,is_system=true WHERE id=$1", table_id, f"{place_type.title()} Builder component: {name}.", category_id, lookup["id"])
            else:
                await conn.execute("INSERT INTO random_tables (id,name,description,category_id,format_id,source_book,is_system) VALUES ($1,$2,$3,$4,$5,$6,true)", table_id, name, f"{place_type.title()} Builder component: {name}.", category_id, lookup["id"], SOURCE)
            column_id = uuid.uuid4()
            await conn.execute("INSERT INTO table_columns (id,table_id,name,die_count,die_sides,sort_order) VALUES ($1,$2,'Result',1,$3,0)", column_id, table_id, len(entries))
            for index, text in enumerate(entries, 1):
                entry_id = uuid.uuid4()
                await conn.execute("INSERT INTO table_entries (id,column_id,min,max,kind,text,sort_order) VALUES ($1,$2,$3,$3,'text',$4,$3)", entry_id, column_id, index, text)
                if namespace:
                    value = facet_value(place_type, slot, text, namespace, index)
                if namespace and value:
                    await conn.execute("INSERT INTO table_entry_tag (entry_id,tag_id) VALUES ($1,$2)", entry_id, tag_ids[f"{namespace}:{value}"])
            components.append((slot, table_id))

        slug = f"{place_type}-builder"
        generator = await conn.fetchrow("SELECT id FROM generators WHERE slug=$1", slug)
        generator_id = generator["id"] if generator else uuid.uuid4()
        description = f"Guide and roll a complete {place_type}, then save it as a world article."
        if generator:
            await conn.execute("UPDATE generators SET name=$2,category_id=$3,description=$4,is_system=true WHERE id=$1", generator_id, f"{place_type.title()} Builder", category_id, description)
            await conn.execute("DELETE FROM generator_components WHERE generator_id=$1", generator_id)
        else:
            await conn.execute("INSERT INTO generators (id,slug,name,category_id,description,combine_template,parameters,is_system) VALUES ($1,$2,$3,$4,$5,'','[]'::jsonb,true)", generator_id, slug, f"{place_type.title()} Builder", category_id, description)
        for order, (slot, table_id) in enumerate(components):
            await conn.execute("INSERT INTO generator_components (id,generator_id,table_id,output_slot,roll_count,optional,sort_order) VALUES ($1,$2,$3,$4,1,true,$5)", uuid.uuid4(), generator_id, table_id, slot, order)
        print(f"generators: seeded/repaired {slug} with {len(components)} tables")


async def main():
    conn = await asyncpg.connect(host=os.environ.get("WW_DB_HOST", "localhost"), port=int(os.environ.get("WW_DB_PORT", "5432")), database=os.environ.get("WW_DB_NAME", "WorldWatcher_DB"), user=os.environ.get("WW_DB_USER", "postgres"), password=os.environ.get("WW_DB_PASSWORD", ""))
    try:
        async with conn.transaction():
            await seed_place_builders(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
