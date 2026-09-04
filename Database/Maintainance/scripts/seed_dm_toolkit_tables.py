"""Seed a broad, original at-table toolkit for campaign improvisation.

This complements imported source tables without copying non-open rulebook prose. Tables
are system-owned, transactional, and fully replaced on rerun so the seed is also a repair.
"""
from __future__ import annotations

import asyncio
import os
import uuid

import asyncpg

SOURCE = "WorldWatcher DM Toolkit (Original)"
SRD_SOURCE = "D&D 5.1 SRD (CC BY 4.0)"


def options(value: str) -> list[str]:
    return [item.strip() for item in value.split("|") if item.strip()]


# category slug, table name, pipe-separated results, tags, optional format
TABLES = [
    # Weather, sky, and environmental conditions
    ("weather", "Weather — Temperate Spring", options("Cool drizzle and low cloud|Bright sun after a cold dawn|Gusty showers moving quickly east|Warm, humid air and distant thunder|Dense morning fog that burns off by noon|Steady rain swelling every stream|Clear sky with a sharp north wind|Brief hail followed by brilliant sunlight|Unseasonable frost in shaded places|Soft rain carrying yellow pollen|A still, gray day with excellent visibility|A violent squall lasting 1d4 hours"), ["topic:weather", "season:spring", "climate:temperate"]),
    ("weather", "Weather — Temperate Summer", options("Hot and cloudless|Warm with a cooling breeze|Heavy afternoon thunderstorm|Oppressive humidity and no wind|Warm rain from dawn to dusk|Dry lightning on the horizon|Cool, clear, and unusually pleasant|Sudden downpour that floods low ground|Hazy heat reducing distant visibility|Strong winds before a cold front|Warm night filled with insects|Severe storm with dangerous gusts"), ["topic:weather", "season:summer", "climate:temperate"]),
    ("weather", "Weather — Temperate Autumn", options("Crisp sun and falling leaves|Cold rain driven sideways|Warm, golden afternoon|Dense fog in every hollow|First hard frost|Steady wind stripping the trees|Gray drizzle and muddy roads|Sudden sleet at dusk|Clear sky and an early freeze|Rotting leaves make slopes slick|A mild day followed by a bitter night|Thunderstorm marking the season's turn"), ["topic:weather", "season:autumn", "climate:temperate"]),
    ("weather", "Weather — Temperate Winter", options("Dry cold beneath a clear sky|Light snow accumulating slowly|Heavy snow and rising wind|Freezing rain glazing roads and roofs|Brief thaw turning snow to slush|Bitter wind and blowing powder|Low cloud with no precipitation|Wet snow clinging to every branch|Ice fog near water|A bright but dangerously cold day|Rapid temperature drop after sunset|Blizzard conditions for 2d6 hours"), ["topic:weather", "season:winter", "climate:cold"]),
    ("weather", "Weather — Desert", options("Clear, dry heat|High thin clouds and harsh glare|Hot wind carrying fine dust|A cool morning before punishing heat|Dust devil crosses the route|Wide dust storm approaching|Dry thunder with no rain|Brief cloudburst and flash-flood risk|Unseasonably cool day|Mirage-like heat shimmer|Cold night with a hard wind|Red rain leaves mineral stains"), ["topic:weather", "climate:arid", "env:desert"]),
    ("weather", "Weather — Tropical", options("Warm rain in short bursts|Brilliant sun and crushing humidity|All-day monsoon rain|Thunderheads building over the canopy|Mist clinging beneath the trees|Strong coastal wind|Sudden rain followed by steaming heat|Torrential storm at dusk|Cloudless and unusually dry|Warm fog along rivers|Cyclonic winds visible offshore|Greenish sky before violent hail"), ["topic:weather", "climate:tropical", "env:jungle"]),
    ("weather", "Unnatural Weather Omens", options("Rain falls upward into a black cloud|Every thunderclap repeats a spoken name|Snowflakes land as tiny paper letters|Shadows point toward the same distant place|A red aurora is visible at noon|Wind circles one traveler and ignores the rest|Clouds form a vast open eye|Warm rain leaves no wetness|Lightning climbs from ground to sky|For one hour the sun casts two shadows|Fog preserves footprints from years ago|Stars remain visible through daylight"), ["topic:weather", "topic:omen", "theme:cosmic"]),

    # Travel and wilderness
    ("travel-events", "Roadside Events", options("A broken cart blocks the narrowest point|A milestone lists a town nobody knows|Pilgrims share food and contradictory warnings|Fresh hoofprints leave the road at a stone wall|A toll collector carries convincing but obsolete papers|A shepherd searches for one unusually clever sheep|A courier asks the party to witness a sealed delivery|A bridge keeper refuses coin but requests a story|An abandoned campfire is still warm|Two merchant caravans accuse each other of theft|A funeral procession travels without a body|Workers are moving the entire road ten feet east"), ["topic:travel", "env:road"]),
    ("travel-events", "Journey Setbacks", options("A pack strap snaps at the worst moment|The reliable map omits a new ravine|Drinking water acquires a harmless foul taste|A mount throws a shoe or injures a foot|Progress attracts persistent biting insects|A guide recognizes signs of territorial danger|The party overshoots a hidden turn|A shortcut costs more time than it saves|Supplies were packed in the wrong container|A landmark has recently been destroyed|Noise carries much farther than expected|A safe campsite is already occupied"), ["topic:travel", "outcome:complication"]),
    ("travel-events", "Wilderness Discoveries", options("A spring flows from a carved stone mouth|An enormous shed antler is covered in runes|A tree has grown around an unopened door|A circle of warm stones remains snow-free|An old boundary marker names a vanished realm|Hundreds of butterflies gather on a skeleton|A tiny shrine contains a freshly lit candle|A rope bridge spans a gap too narrow to need it|A glassy crater hums during sunset|Animal tracks form deliberate writing|A ruined watchtower offers a commanding view|A field of flowers closes as the party approaches"), ["topic:travel", "env:wilderness"]),
    ("travel-events", "River and Ford Events", options("The ford is deeper than yesterday|A ferryman recognizes one hero by name|Debris upstream warns of a broken dam|Bright fish gather around a sunken statue|A rope ferry has been tied off on the far bank|Someone has built a shrine beneath the bridge|The current carries hundreds of white feathers|A stranded boat contains maps but no crew|Stepping-stones rearrange between crossings|A territorial animal guards the only shallow water|A message bottle is addressed to the finder|The river briefly flows backward at moonrise"), ["topic:travel", "env:river"]),
    ("travel-events", "Sea Voyage Events", options("A sail appears without a ship beneath it|Dolphins pace the vessel and refuse to leave|A floating chapel bell rings below the waves|The wind dies inside a perfect circle|A damaged merchant ship requests timber|The catch contains a sealed brass key|Bioluminescent water traces something enormous|A waterspout reveals wreckage at its center|A stowaway claims to own the ship|The stars indicate the vessel moved while anchored|An island appears on no chart|A ghostly lighthouse shines from open water"), ["topic:travel", "env:sea", "theme:nautical"]),
    ("travel-events", "Mountain Pass Events", options("A rockfall exposes an old stairway|Thin air forces a slower pace|A warning horn echoes from the wrong valley|Goats carry scraps of expensive cloth|An avalanche has uncovered a frozen camp|A hermit offers shelter in exchange for news|The trail crosses a territorial nesting site|Meltwater has erased the switchback|Carved faces watch from an inaccessible cliff|A hanging bridge is missing three planks|Clouds fill the pass from below|A warm cave contains fresh bootprints"), ["topic:travel", "env:mountain"]),

    # Dungeon creation and dressing
    ("dungeons", "Dungeon Purposes", options("Royal tomb and memorial|Prison for an immortal intelligence|Mine that breached older ruins|Fortress guarding a sealed road|Temple built around a miracle|Archive protected from a past catastrophe|Laboratory for dangerous transformations|Hidden refuge for a persecuted community|Vault for evidence too dangerous to destroy|Waterworks serving a lost city|Training maze for an extinct order|Machine intended to regulate local magic"), ["topic:dungeon", "phase:worldbuilding"]),
    ("dungeons", "Dungeon Entrances", options("Behind a seasonal waterfall|Inside a hollow monument|Beneath a movable market stall|Through a well visible only at night|At the bottom of a monster's abandoned burrow|Past a door carved into living roots|Under a bridge's central pier|Within a quarry wall exposed by blasting|Through a crypt whose occupants object|Behind a mirror that reflects an open passage|Down a chimney in a ruined manor|Inside the shadow of a standing stone at sunset"), ["topic:dungeon"]),
    ("dungeons", "Dungeon Room Functions", options("Guard post with overlapping sightlines|Kitchen and food storage|Barracks or nesting chamber|Workshop with unfinished projects|Shrine used for private vows|Archive with a damaged index|Audience hall designed to intimidate|Waste pit connected to lower levels|Infirmary with old restraints|Treasury containing convincing decoys|Transit hub with several locked routes|Maintenance chamber controlling a nearby hazard"), ["topic:dungeon", "phase:prep"]),
    ("sensory-dressing", "Dungeon Sensory Details", options("Condensation beads vibrate before footsteps|The air smells of wet copper|A draft carries distant cooking smoke|Fine dust outlines recently moved furniture|Moss glows when voices rise|Water drips in a repeating seven-beat rhythm|Warm stone contrasts with freezing air|Scratches cluster around every keyhole|A low tone is felt more than heard|Small bones have been sorted by size|Old incense masks a sharper chemical smell|The floor tilts almost imperceptibly east"), ["topic:dungeon", "topic:scene"]),
    ("dungeons", "Dungeon Connections", options("A broad stair with no railing|A crawlspace behind loose masonry|A flooded passage with an air pocket|A lift operated by counterweights|A one-way chute into soft debris|A rotating room aligned by a wall crank|A cracked bridge above another route|A secret door opened from the far side|A chimney climb with iron pegs|A teleport circle missing one symbol|A passage through an occupied lair|A narrow ledge around a vertical shaft"), ["topic:dungeon"]),
    ("dungeons", "Dungeon Faction Goals", options("Recover a relic before rivals find it|Keep the sealed lower level closed|Drive intruders toward a waiting predator|Repair the site's original machinery|Escape without alerting their employer|Claim territory around the water source|Complete a ritual requiring several rooms|Rescue a captured leader|Destroy records of an old crime|Trade with explorers while hiding weakness|Awaken the being that built the site|Abandon the dungeon after one final theft"), ["topic:dungeon", "topic:faction"]),
    ("dungeons", "Empty Room Clues", options("Fresh wax beneath an unlit sconce|A chair faces a blank wall|Mud from a different environment marks the floor|One stone is warm to the touch|A meal was abandoned after a single bite|A chalk arrow has been carefully erased|The room's echo suggests a hollow space|A locked chest contains only packing straw|Names and dates cover the underside of a table|A window-shaped patch is free of dust|A snapped thread crosses the doorway|A recent repair uses unfamiliar tools"), ["topic:dungeon", "theme:mystery"]),

    # NPC and social play
    ("npc-generation", "NPC Immediate Needs", options("A discreet place to hide until dawn|Help translating a threatening letter|A neutral witness for a risky exchange|Medicine unavailable through legal channels|Someone to retrieve an embarrassing possession|Protection while delivering bad news|Proof that a loved one is still alive|A guide through hostile territory|Advice before making an irreversible promise|Help identifying who is following them|A convincing distraction for ten minutes|A trustworthy buyer for forbidden knowledge"), ["topic:npc", "phase:improv"]),
    ("npc-generation", "NPC Conversation Openers", options("You look like people who finish what they start.|Tell me—how much trouble are you already in?|I was warned about you, but not accurately.|Before you ask, the answer is no. Probably.|You arrived one day earlier than my dream predicted.|If anyone asks, we have never met.|That symbol you carry has a history here.|I can explain the blood, or I can save us time.|You owe me nothing yet; let us keep it that way.|Which of you is best at keeping a secret?|I have good news for someone less sensible.|Please sit down before you notice what is missing."), ["topic:npc", "topic:scene"]),
    ("npc-generation", "NPC Competencies", options("Remembers every local family connection|Can repair delicate clockwork|Reads tracks on crowded streets|Knows which officials accept favors|Identifies poisons by scent|Navigates by stars hidden behind cloud|Mimics handwriting convincingly|Calms frightened animals|Appraises gems and forged valuables|Understands battlefield logistics|Finds structural weaknesses in buildings|Recognizes obscure religious customs"), ["topic:npc"]),
    ("npc-generation", "NPC Liabilities", options("Cannot keep their temper around bullies|Is recognized by local criminals|Panics in enclosed underground spaces|Owes favors to three incompatible patrons|Refuses to break a literal promise|Is followed by a curious minor spirit|Cannot read but pretends otherwise|Has a distinctive and memorable laugh|Believes a dangerous superstition|Needs expensive medicine each week|Is legally barred from carrying weapons|Mistakes flattery for friendship"), ["topic:npc", "outcome:complication"]),
    ("rumors-gossip", "Rumor Truthfulness", options("True, but the cause is misunderstood|True and deliberately suppressed|Mostly true with one dangerous error|True only during a particular season|False, invented to protect someone|False, spread for profit|False, but becoming true through belief|Two unrelated stories have been combined|The names are wrong but events are accurate|The event happened in a different location|The rumor predicts a plan not yet attempted|No one knows; the evidence was destroyed"), ["topic:rumor", "theme:mystery"]),
    ("overheard-conversations", "Overheard Conversations", options("Two guards disagree about a newly sealed gate|A merchant quietly refunds a frightened customer|A priest asks why the bells rang at midnight|Dockworkers joke about a ship with no shadow|A child insists the statue moved again|A courier cannot find a street on their route|Two nobles rehearse an accidental meeting|A healer requests more silver thread|An innkeeper warns a regular to leave town|A mason complains about warm stones underground|A veteran recognizes an enemy's marching song|A scholar offers too much money for a blank page"), ["topic:scene", "theme:intrigue"]),

    # Adventure structure
    ("adventure-premises", "Adventure Premises", options("A rescue target refuses to be rescued|A peace summit is held in a haunted fortress|A stolen object is safer with the thief|A frontier settlement is built atop a sleeping machine|A prophecy is being counterfeited for political gain|A monster hunt reveals the monster is guarding something|A festival competition determines control of a trade route|A missing expedition has founded a rival colony|A magical cure works but transfers the affliction|A siege continues though both rulers want peace|A dead explorer's map changes every morning|A public execution is interrupted by the condemned's double"), ["topic:quest", "phase:prep"]),
    ("adventure-hooks", "Urgent Adventure Hooks", options("The next victim has only hours|The only bridge closes at sunset|A rival group departed this morning|The evidence will be destroyed during a ceremony|An eclipse opens the route for one night|A witness plans to flee on the next ship|The ransom deadline expires at dawn|Floodwater is rising through the lower district|A vote occurs before the party can rest|The creature migrates after the first frost|A magical contract activates in 2d6 hours|Reinforcements arrive for the enemy tomorrow"), ["topic:hook", "phase:improv"]),
    ("adventure-villains", "Villain Public Faces", options("Generous employer of local artisans|Decorated defender of the frontier|Soft-spoken religious reformer|Popular organizer of public festivals|Scholar funding free education|Merchant who stabilized food prices|Diplomat credited with ending a war|Healer serving the poorest district|Retired adventurer with beloved stories|Magistrate famous for fair verdicts|Patron rebuilding after a disaster|Artist whose work inspires civic pride"), ["topic:villain", "theme:intrigue"]),
    ("adventure-villains", "Villain Methods", options("Manufactures emergencies only they can solve|Buys loyalty by forgiving carefully chosen debts|Replaces records rather than witnesses|Turns allies against one another with true secrets|Uses charitable work to identify vulnerable targets|Creates legal traps with impossible deadlines|Employs monsters through negotiated contracts|Frames accidents as supernatural warnings|Controls access to a necessary resource|Offers enemies exactly what they wanted too late|Delegates cruelty to respectable institutions|Makes every victim appear complicit"), ["topic:villain"]),
    ("adventure-complications", "Plot Twists", options("The patron and target are the same person|The apparent deadline was invented to force haste|The stolen item chose to leave|The villain is containing a greater threat|The witness remembers events from a different timeline|The reward has already been paid to an impostor|The rival group is trying to protect the party|The prophecy describes a place, not a person|The curse is enforcing a broken agreement|The missing person left clues to prevent rescue|The monster is an unwilling transformed ally|Success fulfills the enemy's backup plan"), ["outcome:twist", "topic:quest"]),
    ("adventure-climaxes", "Adventure Climaxes", options("A three-way confrontation during an evacuation|A negotiation while the battlefield collapses|A chase through a changing magical landscape|A public trial where evidence becomes animated|A ritual that must be completed and sabotaged at once|A duel whose audience controls the terrain|A rescue from a vehicle already in motion|A choice between preserving truth and preserving peace|A defense of several locations linked by portals|A heist during the villain's victory celebration|A battle where destroying the objective means defeat|A final choice offered by the apparent antagonist"), ["topic:quest", "phase:prep"]),

    # Hazards, traps, chases, and puzzles
    ("traps", "Trap Purposes", options("Raise a silent alarm|Separate intruders|Destroy stolen evidence|Delay pursuit|Mark trespassers for tracking|Force movement into a guarded route|Capture one target alive|Consume a scarce resource|Test knowledge rather than dexterity|Protect occupants from something outside|Release a negotiable guardian|Seal the complex after activation"), ["topic:trap"]),
    ("traps", "Trap Tells", options("Scratches stop before one floor tile|Cobwebs avoid a narrow vertical line|Soot darkens only the ceiling's edges|A draft emerges from a keyhole|Old blood has been scrubbed from the grout|Metal fittings are warmer than nearby stone|Tiny holes form a deliberate pattern|The doorframe was replaced more recently|Dust has settled on an invisible surface|A faint medicinal smell masks oil|A decorative face has movable eyes|One section produces no echo"), ["topic:trap", "phase:at-table"]),
    ("environmental-hazards", "Environmental Hazard Escalation", options("Movement becomes difficult|Visibility drops to a few yards|Communication beyond shouting fails|Exposed supplies begin to spoil|A safe route closes|Creatures flee through the area|Rest becomes impossible|Metal or magic starts attracting danger|The hazard separates the group|Local guides refuse to continue|A second hazard begins interacting with the first|The environment starts changing permanently"), ["topic:hazard", "outcome:complication"]),
    ("chase-complications", "Urban Chase Complications", options("A handcart rolls across the route|A crowd exits a theater|Scaffolding narrows the street|A funeral procession refuses to break formation|Laundry lines obscure rooftop gaps|A guard patrol mistakes who is pursuing whom|A market awning collapses|A startled mount bolts into traffic|An open cellar offers a risky shortcut|A locked gate requires immediate improvisation|A street performer draws a sudden crowd|The quarry changes disguise in plain sight"), ["topic:chase", "env:urban"]),
    ("chase-complications", "Wilderness Chase Complications", options("Loose scree gives way|Thorny growth hides a drop|A territorial herd crosses the path|The trail divides around a flooded hollow|A fallen tree forms a narrow balance beam|Mud preserves tracks but slows movement|A swarm erupts from disturbed ground|The quarry doubles back through water|Sudden fog hides nearby hazards|A rope bridge begins to fail|A steep climb exposes pursuers|The route enters another creature's lair"), ["topic:chase", "env:wilderness"]),
    ("scene-prompts", "Puzzle Mechanisms", options("Rotating rings align a forgotten map|Weights must balance symbolic offerings|Mirrors redirect light of different colors|Spoken words become physical keys|A miniature room controls the full-sized chamber|Tiles remember the order they were crossed|Musical tones move platforms|Water level reveals and conceals clues|Statues exchange held objects when unobserved|A clock runs backward when lies are spoken|Shadows must be arranged into a missing figure|Doors open only when nobody faces them"), ["theme:mystery", "topic:puzzle"]),

    # Treasure, rewards, and curious objects
    ("trinkets-curios", "Found Pocket Contents", options("A key labeled with tomorrow's date|Three smooth stones wrapped in a receipt|A tiny portrait with the face scratched out|A list of names, including one hero|A glass bead containing moving smoke|A half-finished apology letter|A ticket for a ship that never arrived|A pressed flower from a distant climate|A brass token accepted by no known guild|A child's drawing of the current location|Two mismatched dice that always total seven|A wax seal from a dissolved noble house"), ["topic:trinket"]),
    ("item-quirks", "Magic Item Minor Quirks", options("Warms near hidden doors|Smells faintly of rain before danger|Refuses to function for anyone using a false name|Records each owner as a tiny engraved mark|Attracts harmless moths|Repeats the last whispered word at dawn|Changes color to match the local sky|Produces a distant bell tone when drawn|Makes nearby ink shimmer|Feels heavier when carried away from its purpose|Casts the shadow of its original maker|Repairs one cosmetic scratch each midnight"), ["topic:magic-item"]),
    ("item-quirks", "Sentient Item Desires", options("To be carried into a place no one has mapped|To reconcile descendants of former owners|To destroy every copy of a particular book|To become famous without revealing its nature|To protect apprentices and novices|To complete the task it was forged for|To collect songs from every culture|To expose oathbreakers|To be returned to the material it came from|To prevent an approaching historical mistake|To choose a worthier bearer|To experience an ordinary peaceful life"), ["topic:magic-item", "rarity:sentient"]),
    ("non-item-rewards", "Non-Monetary Rewards", options("A reliable local contact|Safe passage through controlled territory|A public commendation|Access to a restricted archive|A favor from a skilled artisan|Temporary use of a secure base|A secret route across a border|Training in a specialized technique|A legal exemption or permit|Hospitality from a widespread organization|The answer to one carefully phrased question|Custody of a useful but demanding companion"), ["topic:treasure", "outcome:reward"]),
    ("gems-art-objects", "Art Object Details", options("Silver cup engraved with an erased genealogy|Painted screen showing four impossible seasons|Ivory game pieces from a lost ruleset|Bronze mask designed for a nonhuman face|Tapestry with one figure stitched in newer thread|Crystal decanter that never gathers dust|Miniature ship made from different wrecks|Ceremonial blade bearing peaceful vows|Mosaic icon assembled from foreign coins|Mechanical songbird missing its key|Lacquered box whose maker hid a map in the grain|Marble bust altered to resemble a later ruler"), ["topic:treasure"]),
    ("treasure-hoards", "Hoard Story Clues", options("Most coins share the same recent mint year|Several objects belonged to one missing family|Everything is cataloged in meticulous ledgers|Valuables are mixed with sentimental rubbish|One chest has been emptied and carefully relocked|The collection includes trophies from both sides of a war|Items bear marks of systematic grave robbery|Every reflective object has been covered|The hoard is arranged as a scale model of a city|Letters show the wealth was intended as restitution|A portion has been packed for immediate transport|Several valuable pieces are expert replicas"), ["topic:treasure", "theme:mystery"]),

    # Flavor, omens, factions, and downtime
    ("rumors-gossip", "Tavern Rumors", options("The old north road is shorter after midnight|A magistrate pays taxes under a second name|Someone is buying every blue candle in town|The abandoned mill grinds grain during storms|A fisherman caught the same silver ring three times|The duke's new portrait is aging instead of him|A healer has begun refusing payment in coin|Stray dogs wait outside one boarded house|A caravan arrived carrying only empty cages|The temple bell rang from beneath the river|A famous outlaw attends every public execution|Fresh flowers appear weekly on an unmarked grave"), ["topic:rumor", "topic:tavern"]),
    ("dreams-visions-omens", "Dreams and Omens", options("A door in the moon opens inward|You count thirteen companions but see only twelve|A crown melts into clear water|Birds carry threads from your clothing eastward|Your reflection asks you not to wake|A black tree grows fruit shaped like bells|The road behind you fills with seawater|A familiar voice speaks from an unopened book|You bury a key and later find it in your mouth|Every star goes dark except one beneath the horizon|A wounded animal leads you to your childhood home|You win a battle and cannot remember the enemy"), ["topic:dream", "topic:omen"]),
    ("faction-events", "Faction Turn Events", options("A respected lieutenant defects|An unexpected donation expands operations|A scandal damages public trust|A rival proposes a limited truce|A remote cell stops responding|New leadership changes one core policy|A successful recruitment drive strains supplies|Evidence exposes internal corruption|The faction gains control of a strategic route|An ally demands repayment of an old favor|A public success attracts dangerous scrutiny|Two subgroups openly dispute priorities"), ["topic:faction", "phase:downtime"]),
    ("faction-events", "Faction Objectives", options("Control a necessary trade route|Replace a hostile official|Recover a symbol of legitimacy|Recruit a rare specialist|Discredit a rival without open conflict|Protect a vulnerable community|Monopolize access to forbidden knowledge|End a costly internal feud|Establish a safehouse in hostile territory|Secure recognition from a foreign power|Prevent a predicted catastrophe|Change a law before the next succession"), ["topic:faction"]),
    ("downtime-activity-outcomes", "Downtime Complications", options("A rival claims credit for the work|A useful contact asks an immediate favor|The activity uncovers an unrelated secret|Success attracts a tax or licensing dispute|A tool or workspace needs costly repair|An old acquaintance reappears|The result is excellent but delivered late|Someone offers to buy the unfinished work|A harmless misunderstanding damages reputation|Materials were obtained from a dubious source|A student surpasses their teacher unexpectedly|The activity solves one problem and reveals two more"), ["phase:downtime", "outcome:complication"]),
    ("bastion-events", "Bastion Events", options("A skilled traveler requests temporary lodging|A storeroom inventory reveals hidden contraband|Workers discover older foundations|A neighboring community asks for emergency aid|An unusual animal adopts the grounds|A supplier offers suspiciously favorable terms|Two hirelings bring a personal dispute to leadership|A festival draws more visitors than expected|A minor haunting proves helpful|Weather damages one facility|A messenger arrives for a former owner|An inspector finds a rule nobody knew existed"), ["topic:bastion", "phase:downtime"]),
    ("time-calendar", "Festival Themes", options("First planting and shared labor|Honoring local ancestors|The return of migratory creatures|A historic peace agreement|Masks, misrule, and reversed offices|Craft contests and apprenticeships|River blessing and boat races|The year's longest night|Public forgiveness of minor debts|Military remembrance and veterans|A legendary monster's defeat|Welcome for travelers and new residents"), ["phase:worldbuilding"]),
    ("time-calendar", "Calendar Day Details", options("Market day fills the main roads|A local fast closes kitchens until dusk|Courts hear only old unresolved cases|Children exchange handmade charms|No bells may be rung|Travelers traditionally receive free water|Contracts signed today require three witnesses|The moon is considered lucky for beginnings|Work ends early for communal repairs|Names of the recently dead are read aloud|People wear one item inside out|An old superstition forbids lending tools"), ["phase:worldbuilding"]),

    # Open SRD card-name reference with concise paraphrases, using deck semantics.
    ("magic-items", "Deck of Many Things — SRD Card Draw", options("Vizier — gain a truthful answer or solution to a dilemma|Sun — gain great experience and a beneficial wondrous item|Moon — receive the power to invoke 1d3 wishes|Star — increase one ability, within the item's limit|Comet — defeat the next hostile encounter alone to gain a level|The Fates — erase one past event as though it never occurred|Throne — gain commanding presence and rightful claim to a keep|Key — a rare or rarer magic weapon appears in your hands|Knight — a loyal fighter enters your service|Gem — valuable jewelry and gems appear|Talons — carried or owned magic items vanish|The Void — your soul is imprisoned elsewhere|Flames — a powerful fiend becomes your enemy|Skull — an avatar of death appears and must be fought alone|Idiot — intellect is reduced; you may draw again|Donjon — you vanish into extradimensional imprisonment|Ruin — nonmagical wealth and property are lost|Euryale — suffer a persistent penalty to saving throws|Rogue — a trusted NPC secretly turns against you|Balance — your moral alignment is radically reversed|Fool — lose experience and must draw again|Jester — gain experience or choose two additional draws"), ["topic:magic-item", "rarity:legendary"], "deck", SRD_SOURCE),
]


async def seed_dm_toolkit_tables(conn: asyncpg.Connection) -> None:
    categories = {r["slug"]: r["id"] for r in await conn.fetch("SELECT id,slug FROM category")}
    formats = {r["slug"]: r["id"] for r in await conn.fetch("SELECT id,slug FROM table_formats")}
    tags = {f"{r['namespace']}:{r['value']}": r["id"] for r in await conn.fetch("SELECT id,namespace,value FROM tag")}
    missing = sorted({row[0] for row in TABLES} - set(categories))
    if missing or "lookup" not in formats or "deck" not in formats:
        raise RuntimeError(f"Run seed_random_tables_taxonomy.py first; missing categories: {missing}")

    total_entries = 0
    for row in TABLES:
        category_slug, name, entries, tag_keys, *extras = row
        format_slug = extras[0] if extras else "lookup"
        source = extras[1] if len(extras) > 1 else SOURCE
        existing = await conn.fetchrow("SELECT id FROM random_tables WHERE name=$1 AND source_book=$2", name, source)
        table_id = existing["id"] if existing else uuid.uuid4()
        description = "System-owned DM improvisation table; original WorldWatcher content."
        if source == SRD_SOURCE:
            description = "Card names and concise effect summaries from the D&D 5.1 SRD, licensed CC BY 4.0."
        if existing:
            await conn.execute("DELETE FROM table_columns WHERE table_id=$1", table_id)
            await conn.execute(
                "UPDATE random_tables SET description=$2,category_id=$3,format_id=$4,is_system=true WHERE id=$1",
                table_id, description, categories[category_slug], formats[format_slug],
            )
            await conn.execute("DELETE FROM random_table_tag WHERE table_id=$1", table_id)
        else:
            await conn.execute(
                "INSERT INTO random_tables(id,name,description,category_id,format_id,source_book,is_system) VALUES($1,$2,$3,$4,$5,$6,true)",
                table_id, name, description, categories[category_slug], formats[format_slug], source,
            )
        column_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO table_columns(id,table_id,name,die_count,die_sides,sort_order) VALUES($1,$2,'Result',1,$3,0)",
            column_id, table_id, len(entries),
        )
        await conn.executemany(
            "INSERT INTO table_entries(id,column_id,min,max,kind,text,sort_order) VALUES($1,$2,$3,$3,'text',$4,$3)",
            [(uuid.uuid4(), column_id, i, text) for i, text in enumerate(entries, 1)],
        )
        for key in tag_keys:
            if key in tags:
                await conn.execute("INSERT INTO random_table_tag(table_id,tag_id) VALUES($1,$2) ON CONFLICT DO NOTHING", table_id, tags[key])
        total_entries += len(entries)
    print(f"dm_toolkit: seeded/repaired {len(TABLES)} tables with {total_entries} entries")


async def repair_imported_d100_ranges(conn: asyncpg.Connection) -> int:
    """Repair legacy imports where printed d100 value 00 was stored as integer zero."""
    result = await conn.execute(
        """UPDATE table_entries e SET min=CASE WHEN min=0 THEN 100 ELSE min END,
                                      max=CASE WHEN max=0 THEN 100 ELSE max END
           FROM table_columns c, random_tables r
           WHERE e.column_id=c.id AND c.table_id=r.id AND c.die_sides=100
             AND r.is_system=true AND (e.min=0 OR e.max=0)"""
    )
    return int(result.rsplit(" ", 1)[-1])


async def repair_legacy_mixed_dice(conn: asyncpg.Connection) -> int:
    """Preserve d12+d8 encounter probabilities lost by the legacy homogeneous-dice schema.

    A weighted pool is equivalent for a single draw: each range receives the number of
    d12+d8 outcomes that land inside it.
    """
    names = ["At Sea", "Sylvan Forest", "Undersea", "Urban (Dungeon Master's Guide (2014))"]
    weighted_format = await conn.fetchval("SELECT id FROM table_formats WHERE slug='weighted_pool'")
    rows = await conn.fetch(
        """SELECT r.id AS table_id,e.id AS entry_id,e.min,e.max
           FROM random_tables r JOIN table_columns c ON c.table_id=r.id
           JOIN table_entries e ON e.column_id=c.id
           WHERE r.source_book='5etools import' AND r.name=ANY($1::text[])""",
        names,
    )
    counts = {total: sum(1 for d12 in range(1, 13) for d8 in range(1, 9) if d12 + d8 == total) for total in range(2, 21)}
    repaired = 0
    for row in rows:
        weight = sum(counts.get(total, 0) for total in range(row["min"], row["max"] + 1))
        status = await conn.execute("UPDATE table_entries SET weight=$2 WHERE id=$1 AND weight IS DISTINCT FROM $2", row["entry_id"], weight)
        repaired += int(status.rsplit(" ", 1)[-1])
    if rows:
        await conn.execute(
            """UPDATE random_tables SET format_id=$2,
                   description=CASE WHEN coalesce(description,'') LIKE '%Probability repaired from%'
                                    THEN description ELSE concat_ws(' ',description,$3::text) END
               WHERE id=ANY($1::uuid[])""",
            list({row["table_id"] for row in rows}), weighted_format,
            "Probability repaired from the source's d12+d8 expression as exact entry weights.",
        )
    return repaired


async def main() -> None:
    conn = await asyncpg.connect(
        host=os.environ.get("WW_DB_HOST", "localhost"), port=int(os.environ.get("WW_DB_PORT", "5432")),
        database=os.environ.get("WW_DB_NAME", "WorldWatcher_DB"), user=os.environ.get("WW_DB_USER", "postgres"),
        password=os.environ.get("WW_DB_PASSWORD", ""),
    )
    try:
        async with conn.transaction():
            repaired = await repair_imported_d100_ranges(conn)
            mixed = await repair_legacy_mixed_dice(conn)
            await seed_dm_toolkit_tables(conn)
        print(f"dm_toolkit: repaired {repaired} legacy d100 range endpoints")
        print(f"dm_toolkit: repaired weights on {mixed} legacy d12+d8 entries")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
