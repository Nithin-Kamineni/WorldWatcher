"""One-off test-data seeder for the app's own static/mock data (NOT
5etools content - see importer/ for that). Pulls the exact values out of:
  Client/src/store/mockCampaigns.ts   -> campaigns
  Client/src/store/seedMaps.ts        -> maps + map_floors
  Client/src/store/seedCreatures.ts   -> creatures (Mira the Blacksmith only)

Idempotent: safe to re-run - looks up existing rows by name/slug before
inserting, and asset files are deduped by sha256 like the main importer.
"""
import json
import mimetypes
import os
import shutil
import sys

import psycopg2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importer.hashing import file_sha256, slugify  # noqa: E402

CLIENT_ASSETS = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "Client", "src", "assets")
)
ASSET_OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")

DB_KWARGS = dict(
    host="localhost", port=5432, dbname="WorldWatcher_DB", user="postgres",
    password=os.environ.get("WW_DB_PASSWORD", ""), connect_timeout=10,
)


def upsert_asset(cur, *, src_path: str, storage_subpath: str, asset_type: str):
    sha = file_sha256(src_path)
    cur.execute("SELECT id FROM assets WHERE sha256 = %s", (sha,))
    row = cur.fetchone()
    if row:
        return row[0]

    dest = os.path.join(ASSET_OUTPUT, storage_subpath.replace("/", os.sep))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if not os.path.exists(dest):
        shutil.copyfile(src_path, dest)

    cur.execute(
        """
        INSERT INTO assets (filename, storage_path, asset_type, mime_type, file_size, sha256, source, source_path)
        VALUES (%s, %s, %s, %s, %s, %s, 'app-seed', %s)
        RETURNING id
        """,
        (
            os.path.basename(src_path), storage_subpath, asset_type,
            mimetypes.guess_type(src_path)[0],
            os.path.getsize(src_path), sha,
            os.path.relpath(src_path, CLIENT_ASSETS).replace(os.sep, "/"),
        ),
    )
    return cur.fetchone()[0]


def get_or_create_campaign(cur, *, name: str, description: str, image_asset_id, ruleset: str):
    cur.execute("SELECT id FROM campaigns WHERE name = %s", (name,))
    row = cur.fetchone()
    if row:
        cur.execute(
            "UPDATE campaigns SET description=%s, image_asset_id=%s, ruleset=%s WHERE id=%s",
            (description, image_asset_id, ruleset, row[0]),
        )
        return row[0], False
    cur.execute(
        """
        INSERT INTO campaigns (name, description, image_asset_id, ruleset)
        VALUES (%s, %s, %s, %s) RETURNING id
        """,
        (name, description, image_asset_id, ruleset),
    )
    return cur.fetchone()[0], True


def get_or_create_map(cur, *, campaign_id, name: str, description: str, map_kinds: list):
    cur.execute("SELECT id FROM maps WHERE campaign_id = %s AND name = %s", (campaign_id, name))
    row = cur.fetchone()
    if row:
        return row[0], False
    cur.execute(
        """
        INSERT INTO maps (campaign_id, name, description, map_kinds)
        VALUES (%s, %s, %s, %s) RETURNING id
        """,
        (campaign_id, name, description, map_kinds),
    )
    return cur.fetchone()[0], True


def get_or_create_floor(cur, *, map_id, name: str, sort_order: int, background_asset_id):
    cur.execute("SELECT id FROM map_floors WHERE map_id = %s AND name = %s", (map_id, name))
    row = cur.fetchone()
    if row:
        return row[0], False
    cur.execute(
        """
        INSERT INTO map_floors (map_id, name, sort_order, background_asset_id)
        VALUES (%s, %s, %s, %s) RETURNING id
        """,
        (map_id, name, sort_order, background_asset_id),
    )
    return cur.fetchone()[0], True


def parse_type(type_str: str):
    # "Humanoid (Human)" -> ("Humanoid", "Human"), matches the same
    # creature_type/creature_subtype split the 5etools importer uses.
    if "(" in type_str and type_str.endswith(")"):
        base, sub = type_str.split("(", 1)
        return base.strip(), sub[:-1].strip()
    return type_str.strip(), None


def parse_cr(cr_str: str):
    fractions = {"1/8": 0.125, "1/4": 0.25, "1/2": 0.5}
    if cr_str in fractions:
        return fractions[cr_str]
    try:
        return float(cr_str)
    except ValueError:
        return None


def upsert_creature(cur, *, campaign_id, category: str, data: dict, token_asset_id=None):
    name = data["name"]
    slug = slugify(name)
    creature_type, creature_subtype = parse_type(data["type"])

    values = {
        "source_id": None,
        "campaign_id": campaign_id,
        "category": category,
        "name": name,
        "slug": slug,
        "creature_type": creature_type,
        "creature_subtype": creature_subtype,
        "size": data.get("size"),
        "alignment": data.get("alignment"),
        "challenge_rating": parse_cr(data["cr"]),
        "challenge_rating_display": data["cr"],
        "proficiency_bonus": data.get("proficiency"),
        "armor_class": data.get("ac"),
        "hit_points": data.get("hp"),
        "hit_dice": data.get("hpFormula"),
        "strength": data["abilities"]["str"],
        "dexterity": data["abilities"]["dex"],
        "constitution": data["abilities"]["con"],
        "intelligence": data["abilities"]["int"],
        "wisdom": data["abilities"]["wis"],
        "charisma": data["abilities"]["cha"],
        "skills": data.get("skills"),
        "senses": data.get("senses"),
        "passive_perception": data.get("passivePerception"),
        "languages": data.get("languages"),
        "traits": data.get("traits"),
        "relation": data.get("relation"),
        "importance": data.get("importance"),
        "profession": data.get("profession"),
        "token_asset_id": token_asset_id,
        "default_size": data.get("defaultSize", 1),
        "current_size": data.get("currentSize", 1),
        # Homebrew creature - no 5etools raw object. `speed` has no relational
        # column by design (database_scehma.txt section 5), so it's kept
        # here for traceability, along with the exact static source object.
        "raw_data": json.dumps({"speed": data.get("speed"), "_seedSource": "Client/src/store/seedCreatures.ts", **data}),
    }
    cols = list(values.keys())
    col_list = ", ".join(cols)
    placeholders = ", ".join(["%s"] * len(cols))
    update_cols = [c for c in cols if c not in ("slug", "campaign_id")]
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    cur.execute(
        f"""
        INSERT INTO creatures ({col_list}) VALUES ({placeholders})
        ON CONFLICT (slug, campaign_id) WHERE campaign_id IS NOT NULL
        DO UPDATE SET {set_clause}
        RETURNING id, (xmax = 0) AS was_insert
        """,
        [values[c] for c in cols],
    )
    return cur.fetchone()


def main():
    conn = psycopg2.connect(**DB_KWARGS)
    cur = conn.cursor()

    # ---- Campaigns ----
    meridian_img = upsert_asset(
        cur, src_path=os.path.join(CLIENT_ASSETS, "worlds", "Meridian.jpg"),
        storage_subpath="campaigns/meridian.jpg", asset_type="other",
    )
    eboron_img = upsert_asset(
        cur, src_path=os.path.join(CLIENT_ASSETS, "worlds", "eboron.png"),
        storage_subpath="campaigns/eboron.png", asset_type="other",
    )
    meridian_id, meridian_new = get_or_create_campaign(
        cur, name="Meridian: A World in Constant Dawn",
        description="A world caught in an eternal dawn, where the party investigates smuggling rings, "
                     "riverside ambushes, and a chapel rumored to be haunted.",
        image_asset_id=meridian_img, ruleset="5e-2014",
    )
    eboron_id, eboron_new = get_or_create_campaign(
        cur, name="Eboron: The Last War",
        description="A war-scarred realm fought over to its final battle, from an arcane ruin at the "
                     "warfront to a retooled factory and the throne room where the war ends.",
        image_asset_id=eboron_img, ruleset="5e-2014",
    )
    print(f"campaigns: Meridian={meridian_id} ({'new' if meridian_new else 'existing'}), "
          f"Eboron={eboron_id} ({'new' if eboron_new else 'existing'})")

    # ---- Maps (exact static set from Client/src/store/seedMaps.ts) ----
    maps_dir = os.path.join(CLIENT_ASSETS, "maps")
    img = {
        "map1": upsert_asset(cur, src_path=os.path.join(maps_dir, "map1.png"), storage_subpath="maps/map1.png", asset_type="map"),
        "map2": upsert_asset(cur, src_path=os.path.join(maps_dir, "map2.png"), storage_subpath="maps/map2.png", asset_type="map"),
        "map3": upsert_asset(cur, src_path=os.path.join(maps_dir, "map3.png"), storage_subpath="maps/map3.png", asset_type="map"),
        "map4": upsert_asset(cur, src_path=os.path.join(maps_dir, "map4.png"), storage_subpath="maps/map4.png", asset_type="map"),
        "abandoned_church": upsert_asset(cur, src_path=os.path.join(maps_dir, "abandoned-church.png"), storage_subpath="maps/abandoned-church.png", asset_type="map"),
        "isolated_factory": upsert_asset(cur, src_path=os.path.join(maps_dir, "isolated-factory.png"), storage_subpath="maps/isolated-factory.png", asset_type="map"),
        "throne_room": upsert_asset(cur, src_path=os.path.join(maps_dir, "throne-room.jpeg"), storage_subpath="maps/throne-room.jpeg", asset_type="map"),
    }

    map_specs = [
        (meridian_id, "Sunken Grotto", "A flooded cave system where the party tracks a smuggling ring.",
         ["battle"], [("Floor 1", img["map1"])]),
        (meridian_id, "Riverside Ambush", "A misty riverbank crossing, prone to bandit ambushes.",
         ["battle", "region"], [("Floor 1", img["map2"]), ("Floor 2", img["map1"])]),
        (meridian_id, "Abandoned Church", "A crumbling chapel on the edge of town, said to be haunted.",
         ["battle"], [("Floor 1", img["abandoned_church"])]),
        (eboron_id, "The Shattered Spire", "A two-level arcane ruin at the heart of the warfront.",
         ["battle"], [("Floor 1", img["map3"]), ("Floor 2", img["map3"])]),
        (eboron_id, "Shadows Over Morvold", "A quiet village hiding a cult beneath its cellars.",
         ["city"], [("Floor 1", img["map4"])]),
        (eboron_id, "Isolated Factory", "A war-scarred manufactory, retooled for something sinister.",
         ["battle"], [("Floor 1", img["isolated_factory"])]),
        (eboron_id, "Throne Room", "The seat of power - final battleground for the war's last stand.",
         ["battle"], [("Floor 1", img["throne_room"])]),
    ]

    for campaign_id, name, description, kinds, floors in map_specs:
        map_id, is_new = get_or_create_map(cur, campaign_id=campaign_id, name=name, description=description, map_kinds=kinds)
        floor_ids = []
        for i, (floor_name, asset_id) in enumerate(floors):
            floor_id, floor_new = get_or_create_floor(cur, map_id=map_id, name=floor_name, sort_order=i, background_asset_id=asset_id)
            floor_ids.append(floor_id)
        cur.execute("UPDATE maps SET primary_floor_id = %s WHERE id = %s AND primary_floor_id IS NULL", (floor_ids[0], map_id))
        print(f"map: {name} ({'new' if is_new else 'existing'}), {len(floor_ids)} floor(s)")

    # ---- Mira the Blacksmith (exact static data from seedCreatures.ts) ----
    mira = {
        "category": "npc", "name": "Mira the Blacksmith", "relation": "ally", "importance": "quest-giver",
        "profession": "Blacksmith", "size": "Medium", "type": "Humanoid (Human)", "alignment": "Neutral Good",
        "ac": 10, "hp": 9, "hpFormula": "2d8", "speed": "30 ft",
        "abilities": {"str": 12, "dex": 10, "con": 11, "int": 10, "wis": 12, "cha": 11},
        "skills": "Smith's Tools +4", "passivePerception": 11, "languages": "Common", "cr": "0",
        "proficiency": 2, "traits": "Runs the forge in town; offers a quest to recover stolen ore.",
        "defaultSize": 1, "currentSize": 1,
    }
    row = upsert_creature(cur, campaign_id=meridian_id, category="npc", data=mira)
    print(f"creature (npc): Mira the Blacksmith id={row[0]} ({'new' if row[1] else 'updated'})")

    # ---- Remaining creatures (exact static data from seedCreatures.ts) ----
    goblin_token = upsert_asset(
        cur, src_path=os.path.join(CLIENT_ASSETS, "tokens", "goblin.png"),
        storage_subpath="tokens/goblin.png", asset_type="creature_token",
    )
    goblin = {
        "category": "monster", "name": "Goblin", "relation": "enemy", "importance": "monster",
        "size": "Small", "type": "Humanoid (Goblinoid)", "alignment": "Neutral Evil",
        "ac": 15, "hp": 7, "hpFormula": "2d6", "speed": "30 ft",
        "abilities": {"str": 8, "dex": 14, "con": 10, "int": 10, "wis": 8, "cha": 8},
        "skills": "Stealth +6", "senses": "Darkvision 60 ft", "passivePerception": 9,
        "languages": "Common, Goblin", "cr": "1/4", "proficiency": 2,
        "defaultSize": 0.8, "currentSize": 0.8,
    }
    hobgoblin = {
        "category": "monster", "name": "Hobgoblin", "relation": "enemy", "importance": "important",
        "size": "Medium", "type": "Humanoid (Goblinoid)", "alignment": "Lawful Evil",
        "ac": 18, "hp": 11, "hpFormula": "2d8+2", "speed": "30 ft",
        "abilities": {"str": 13, "dex": 12, "con": 12, "int": 10, "wis": 10, "cha": 9},
        "senses": "Darkvision 60 ft", "passivePerception": 10, "languages": "Common, Goblin",
        "cr": "1/2", "proficiency": 2, "defaultSize": 1, "currentSize": 1,
    }
    merfolk = {
        "category": "monster", "name": "Merfolk", "relation": "neutral", "importance": "monster",
        "profession": "Guide", "size": "Medium", "type": "Humanoid (Merfolk)", "alignment": "Neutral",
        "ac": 11, "hp": 22, "hpFormula": "4d8+4", "speed": "10 ft, swim 40 ft",
        "abilities": {"str": 10, "dex": 13, "con": 12, "int": 11, "wis": 11, "cha": 12},
        "skills": "Perception +2", "passivePerception": 12, "languages": "Aquan, Common",
        "cr": "1/8", "proficiency": 2, "defaultSize": 1, "currentSize": 1,
    }
    pixie = {
        "category": "monster", "name": "Pixie", "relation": "ally", "importance": "monster",
        "size": "Tiny", "type": "Fey", "alignment": "Neutral Good",
        "ac": 15, "hp": 3, "hpFormula": "1d4+1", "speed": "20 ft, fly 30 ft",
        "abilities": {"str": 2, "dex": 20, "con": 10, "int": 14, "wis": 13, "cha": 18},
        "skills": "Perception +3, Stealth +9", "passivePerception": 13, "languages": "Common, Sylvan",
        "cr": "1/4", "proficiency": 2, "defaultSize": 0.4, "currentSize": 0.4,
    }
    captain_thorne = {
        "category": "npc", "name": "Captain Thorne", "relation": "enemy", "importance": "boss",
        "profession": "Warlord", "size": "Medium", "type": "Humanoid (Human)", "alignment": "Lawful Evil",
        "ac": 17, "hp": 65, "hpFormula": "10d8+20", "speed": "30 ft",
        "abilities": {"str": 16, "dex": 12, "con": 15, "int": 11, "wis": 10, "cha": 14},
        "skills": "Athletics +5, Intimidation +4", "passivePerception": 10, "languages": "Common",
        "cr": "5", "proficiency": 3,
        "traits": "Commands the enemy warband; fights with a greatsword and rallies nearby troops.",
        "defaultSize": 1, "currentSize": 1,
    }

    creature_ids = {}  # (campaign_id, name) -> creature row id, for wiring encounters below
    for campaign_id, campaign_name, roster in (
        (meridian_id, "Meridian", [goblin, hobgoblin, merfolk, pixie]),
        (eboron_id, "Eboron", [goblin, hobgoblin, captain_thorne]),
    ):
        for data in roster:
            token_id = goblin_token if data["name"] == "Goblin" else None
            row = upsert_creature(cur, campaign_id=campaign_id, category=data["category"], data=data, token_asset_id=token_id)
            creature_ids[(campaign_id, data["name"])] = row[0]
            print(f"creature ({data['category']}): {data['name']} [{campaign_name}] id={row[0]} ({'new' if row[1] else 'updated'})")

    # ---- Encounters (exact static data from seedEncounters.ts) ----
    encounter_specs = [
        (meridian_id, "Goblin Ambush", "A goblin warband ambushes the party from the rocks along the trail.",
         "Easy (party level 2-3)", "Ambush", ["forest", "ambush"],
         [("Goblin", 4), ("Hobgoblin", 1)]),
        (eboron_id, "Goblin Raiding Party", "A goblin raiding party scavenging the warfront for supplies.",
         "Medium (party level 3-4)", "Skirmish", ["warfront", "raiders"],
         [("Goblin", 3), ("Hobgoblin", 1)]),
    ]
    for campaign_id, name, description, cr_display, theme, tags, roster in encounter_specs:
        cur.execute("SELECT id FROM encounters WHERE campaign_id = %s AND name = %s", (campaign_id, name))
        row = cur.fetchone()
        if row:
            encounter_id = row[0]
            is_new = False
        else:
            cur.execute(
                """
                INSERT INTO encounters (campaign_id, name, description, challenge_rating_display, theme, tags)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
                """,
                (campaign_id, name, description, cr_display, theme, tags),
            )
            encounter_id = cur.fetchone()[0]
            is_new = True
            for i, (creature_name, quantity) in enumerate(roster):
                cur.execute(
                    """
                    INSERT INTO encounter_creatures (encounter_id, creature_id, quantity, sort_order)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (encounter_id, creature_ids[(campaign_id, creature_name)], quantity, i),
                )
        print(f"encounter: {name} id={encounter_id} ({'new' if is_new else 'existing'})")

    # ---- Magic items (exact static data from seedMagicItems.ts, shared by both campaigns) ----
    item_specs = [
        ("+1 Longsword", "Weapon (longsword)", "uncommon", False,
         "You have a +1 bonus to attack and damage rolls made with this magic weapon."),
        ("Potion of Healing", "Potion", "common", False,
         "You regain hit points when you drink this potion."),
        ("Cloak of Protection", "Wondrous item", "uncommon", True,
         "You gain a +1 bonus to AC and saving throws while wearing this cloak."),
    ]
    for campaign_id in (meridian_id, eboron_id):
        for name, item_type, rarity, attunement, description in item_specs:
            slug = slugify(name)
            cur.execute("SELECT id FROM items WHERE campaign_id = %s AND slug = %s", (campaign_id, slug))
            row = cur.fetchone()
            if not row:
                cur.execute(
                    """
                    INSERT INTO items (campaign_id, name, slug, item_type, rarity, requires_attunement, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
                    """,
                    (campaign_id, name, slug, item_type, rarity, attunement, description),
                )
                row = cur.fetchone()
            print(f"item: {name} [{campaign_id}] id={row[0]}")

    # ---- Spells (exact static data from seedSpells.ts, shared by both campaigns) ----
    spell_specs = [
        ("Fireball", 3, "Evocation", "1 action", "150 ft", "V, S, M", "Instantaneous", "Sorcerer, Wizard",
         "A bright streak flashes to a point and blossoms into a fiery explosion, dealing fire damage in a 20-ft radius."),
        ("Magic Missile", 1, "Evocation", "1 action", "120 ft", "V, S", "Instantaneous", "Sorcerer, Wizard",
         "Three glowing darts of magical force strike unerringly, each dealing force damage."),
        ("Cure Wounds", 1, "Evocation", "1 action", "Touch", "V, S", "Instantaneous", "Bard, Cleric, Druid, Paladin, Ranger",
         "A creature you touch regains a number of hit points."),
        ("Mage Hand", 0, "Conjuration", "1 action", "30 ft", "V, S", "1 minute", "Bard, Sorcerer, Warlock, Wizard",
         "A spectral hand appears and can manipulate objects, open doors, and carry small items."),
    ]
    for campaign_id in (meridian_id, eboron_id):
        for name, level, school, casting_time, range_, components, duration, classes, description in spell_specs:
            slug = slugify(name)
            cur.execute("SELECT id FROM spells WHERE campaign_id = %s AND slug = %s", (campaign_id, slug))
            row = cur.fetchone()
            if not row:
                cur.execute(
                    """
                    INSERT INTO spells (campaign_id, name, slug, level, school, casting_time, range, duration,
                                        components_display, classes_display, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
                    """,
                    (campaign_id, name, slug, level, school, casting_time, range_, duration, components, classes, description),
                )
                row = cur.fetchone()
            print(f"spell: {name} [{campaign_id}] id={row[0]}")

    # NOTE: this used to seed two hardcoded global favorite token_library rows
    # ("Player", "Zombie") here - removed per Bugs.txt #8: favorites are now a
    # real feature (star a monster/NPC in the Creatures table via
    # Creature.is_favorite), not fixed test data. See migration
    # 60961abad1bf for the is_favorite column and cleanup of any
    # already-seeded "Player"/"Zombie" token_library rows.

    conn.commit()
    cur.close()
    conn.close()
    print("done.")


if __name__ == "__main__":
    main()
