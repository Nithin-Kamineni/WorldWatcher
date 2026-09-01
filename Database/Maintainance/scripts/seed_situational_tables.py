"""One-off seed script (not an Alembic migration - this is data, not schema) for the
Encounters "Roleplay & Exploration" tab's situational_tables reference library: curated,
hand-authored non-combat random tables (e.g. a "Darkwood Forest" table with linked
encounter/behavior/complication columns the DM rolls or picks across to build a scene
prompt - NOT a combat encounter generator).

Deliberately network-free, same shape as seed_npc_roleplay_banks.py / seed_places_random_
banks.py. The Darkwood Forest table is transcribed verbatim from the user's own example.
Four more (Rusty Anchor Tavern, Market Street, Forgotten Corridor, Planar Rift) are hand-
authored in the same 2-4-column shape, per the user's "don't limit yourself to one theme"
ask. The Adventure-*/Treasure-* tables are transcribed from the reference images at
random-table-images/ (Adventure-SituationsByLevel.png, Adventure-SituationsByLevel2.png,
Adventure-Planar.png, Adventure-Hooks.png, Adventure-Climax.png, Treasure-Individual.png,
Treasure-Horde.png) - all from the Dungeon Master's Guide (2024), chapter 4/7.

The two Treasure tables are keyed by monster/party Challenge Rating rather than an
independent per-column die roll, so they don't fit the encounter/behavior/complication
shape cleanly: each column's `entries` use a sequential 1-4 `roll` index (matching display
order) with the actual CR band folded into the entry's `text` (e.g. "CR 0-4: 3d6 (10) GP"),
and `dieSize` is set to 0 to flag "this is a lookup by CR, not an independent random roll" -
see each row's `description` for the usage note. Everything else uses a real die size
(6/8/10/12/20) matching its entry count.

Re-runnable: situational_tables has no natural uniqueness constraint on hand-authored
content (same as random_motivations/random_pitfalls), so it's seeded only if currently
empty.
"""
from __future__ import annotations

import asyncio
import json
import os

import asyncpg

# ============================================================
# Hand-authored roleplay/exploration tables
# ============================================================

DARKWOOD_FOREST = {
    "name": "Darkwood Forest",
    "theme": "Forest",
    "tags": ["exploration", "roleplay", "forest", "wilderness"],
    "description": (
        "Wandering encounters for temperate forest travel - not all of these need to end "
        "in combat. Roll (or pick) one entry from each column and combine them: e.g. "
        "3 + 4 + 2 = \"Hunters, on someone else's bidding, whose gear is broken.\""
    ),
    "source": "Darkwood Forest example",
    "columns": [
        {
            "key": "encounter",
            "label": "Encounter",
            "dieSize": 8,
            "entries": [
                {"roll": 1, "text": "Wolves"},
                {"roll": 2, "text": "Brigands"},
                {"roll": 3, "text": "Hunters"},
                {"roll": 4, "text": "Patrol"},
                {"roll": 5, "text": "Goblins"},
                {"roll": 6, "text": "Dark Boar"},
                {"roll": 7, "text": "Displacers"},
                {"roll": 8, "text": "Wyvern"},
            ],
        },
        {
            "key": "behavior",
            "label": "Behavior",
            "dieSize": 8,
            "entries": [
                {"roll": 1, "text": "Hunting Prey"},
                {"roll": 2, "text": "Grifting for Cash"},
                {"roll": 3, "text": "Setting Traps"},
                {"roll": 4, "text": "Other's Bidding"},
                {"roll": 5, "text": "Digging a Pit"},
                {"roll": 6, "text": "Rooting a Tree"},
                {"roll": 7, "text": "Sleeping by a Tree"},
                {"roll": 8, "text": "Carrying off Food"},
            ],
        },
        {
            "key": "complication",
            "label": "Complication",
            "dieSize": 8,
            "entries": [
                {"roll": 1, "text": "Sick Young"},
                {"roll": 2, "text": "Arrested"},
                {"roll": 3, "text": "Broken Gear"},
                {"roll": 4, "text": "Understaffed"},
                {"roll": 5, "text": "Hate Boss"},
                {"roll": 6, "text": "Injured"},
                {"roll": 7, "text": "Hungry"},
                {"roll": 8, "text": "Tangled Rope"},
            ],
        },
    ],
}

RUSTY_ANCHOR_TAVERN = {
    "name": "The Rusty Anchor Tavern",
    "theme": "Tavern",
    "tags": ["exploration", "roleplay", "tavern", "social"],
    "description": "A rowdy dockside tavern scene generator - combine a patron, what they're doing, and their complication.",
    "source": "Roleplay & Exploration hand-authored table",
    "columns": [
        {
            "key": "patron",
            "label": "Patron",
            "dieSize": 8,
            "entries": [
                {"roll": 1, "text": "Grizzled Sailor"},
                {"roll": 2, "text": "Traveling Bard"},
                {"roll": 3, "text": "Cloaked Stranger"},
                {"roll": 4, "text": "Local Blacksmith"},
                {"roll": 5, "text": "Retired Adventurer"},
                {"roll": 6, "text": "Tipsy Noble"},
                {"roll": 7, "text": "Wandering Cleric"},
                {"roll": 8, "text": "Suspicious Merchant"},
            ],
        },
        {
            "key": "activity",
            "label": "Activity",
            "dieSize": 8,
            "entries": [
                {"roll": 1, "text": "Boasting About a Voyage"},
                {"roll": 2, "text": "Losing at Cards"},
                {"roll": 3, "text": "Recruiting for a Job"},
                {"roll": 4, "text": "Nursing a Grudge"},
                {"roll": 5, "text": "Selling Questionable Goods"},
                {"roll": 6, "text": "Singing (Badly)"},
                {"roll": 7, "text": "Picking a Fight"},
                {"roll": 8, "text": "Sleeping Off a Bad Decision"},
            ],
        },
        {
            "key": "complication",
            "label": "Complication",
            "dieSize": 8,
            "entries": [
                {"roll": 1, "text": "Owes Money to the Wrong Person"},
                {"roll": 2, "text": "Being Watched by a Spy"},
                {"roll": 3, "text": "Carrying Stolen Goods"},
                {"roll": 4, "text": "Wanted by the City Guard"},
                {"roll": 5, "text": "Actually a Doppelganger"},
                {"roll": 6, "text": "Cursed by a Witch"},
                {"roll": 7, "text": "Out of Coin"},
                {"roll": 8, "text": "Followed by Bad Luck"},
            ],
        },
    ],
}

MARKET_STREET = {
    "name": "Market Street",
    "theme": "City Street",
    "tags": ["exploration", "roleplay", "city", "urban"],
    "description": "A bustling market-day street scene - combine a passerby, what they're doing, and the trouble they're in.",
    "source": "Roleplay & Exploration hand-authored table",
    "columns": [
        {
            "key": "passerby",
            "label": "Passerby",
            "dieSize": 8,
            "entries": [
                {"roll": 1, "text": "Street Vendor"},
                {"roll": 2, "text": "Pickpocket"},
                {"roll": 3, "text": "City Guard Patrol"},
                {"roll": 4, "text": "Traveling Diplomat"},
                {"roll": 5, "text": "Beggar"},
                {"roll": 6, "text": "Off-Duty Mercenary"},
                {"roll": 7, "text": "Street Performer"},
                {"roll": 8, "text": "Nervous Courier"},
            ],
        },
        {
            "key": "doing",
            "label": "Doing",
            "dieSize": 8,
            "entries": [
                {"roll": 1, "text": "Hawking Wares Loudly"},
                {"roll": 2, "text": "Arguing Over a Debt"},
                {"roll": 3, "text": "Chasing a Runaway Animal"},
                {"roll": 4, "text": "Handing Out Flyers"},
                {"roll": 5, "text": "Haggling Aggressively"},
                {"roll": 6, "text": "Performing a Trick"},
                {"roll": 7, "text": "Delivering a Sealed Letter"},
                {"roll": 8, "text": "Watching the Crowd Too Closely"},
            ],
        },
        {
            "key": "trouble",
            "label": "Trouble",
            "dieSize": 8,
            "entries": [
                {"roll": 1, "text": "Being Accused of Theft"},
                {"roll": 2, "text": "Being Followed"},
                {"roll": 3, "text": "Lost Something Important"},
                {"roll": 4, "text": "Recognized a Wanted Criminal"},
                {"roll": 5, "text": "Caught in a Guild Dispute"},
                {"roll": 6, "text": "Out of Time"},
                {"roll": 7, "text": "Carrying Something Dangerous"},
                {"roll": 8, "text": "Being Blackmailed"},
            ],
        },
    ],
}

FORGOTTEN_CORRIDOR = {
    "name": "Forgotten Corridor",
    "theme": "Dungeon Corridor",
    "tags": ["exploration", "roleplay", "dungeon"],
    "description": "A stretch of ruined dungeon corridor - combine a physical feature, a hazard, and what the party discovers.",
    "source": "Roleplay & Exploration hand-authored table",
    "columns": [
        {
            "key": "feature",
            "label": "Feature",
            "dieSize": 6,
            "entries": [
                {"roll": 1, "text": "Collapsed Ceiling"},
                {"roll": 2, "text": "Ancient Murals"},
                {"roll": 3, "text": "Flooded Passage"},
                {"roll": 4, "text": "Rusted Portcullis"},
                {"roll": 5, "text": "Overgrown with Fungus"},
                {"roll": 6, "text": "Echoing Chasm"},
            ],
        },
        {
            "key": "hazard",
            "label": "Hazard",
            "dieSize": 6,
            "entries": [
                {"roll": 1, "text": "Pressure Plate Trap"},
                {"roll": 2, "text": "Swarm of Insects"},
                {"roll": 3, "text": "Unstable Floor"},
                {"roll": 4, "text": "Poisonous Spores"},
                {"roll": 5, "text": "Wandering Ooze"},
                {"roll": 6, "text": "Sudden Darkness (Magical)"},
            ],
        },
        {
            "key": "discovery",
            "label": "Discovery",
            "dieSize": 6,
            "entries": [
                {"roll": 1, "text": "A Sealed Vault Door"},
                {"roll": 2, "text": "Skeletal Remains with Gear"},
                {"roll": 3, "text": "Faint Magical Humming"},
                {"roll": 4, "text": "Fresh Footprints"},
                {"roll": 5, "text": "A Hidden Lever"},
                {"roll": 6, "text": "Scratched Warning in the Wall"},
            ],
        },
    ],
}

PLANAR_RIFT = {
    "name": "Planar Rift",
    "theme": "Planar",
    "tags": ["exploration", "roleplay", "planar"],
    "description": "An unstable tear between worlds - combine the phenomenon, its effect, and the danger it poses.",
    "source": "Roleplay & Exploration hand-authored table",
    "columns": [
        {
            "key": "phenomenon",
            "label": "Phenomenon",
            "dieSize": 8,
            "entries": [
                {"roll": 1, "text": "Tear in Reality"},
                {"roll": 2, "text": "Floating Debris from Another World"},
                {"roll": 3, "text": "Shifting Gravity"},
                {"roll": 4, "text": "Colors that Shouldn't Exist"},
                {"roll": 5, "text": "Whispering Voices"},
                {"roll": 6, "text": "Time Skipping Backward"},
                {"roll": 7, "text": "Raining Ash from the Abyss"},
                {"roll": 8, "text": "Silence that Swallows Sound"},
            ],
        },
        {
            "key": "effect",
            "label": "Effect",
            "dieSize": 8,
            "entries": [
                {"roll": 1, "text": "Random Teleportation"},
                {"roll": 2, "text": "Memories Begin to Fade"},
                {"roll": 3, "text": "Creatures Phase In and Out"},
                {"roll": 4, "text": "Magic Behaves Unpredictably"},
                {"roll": 5, "text": "Emotions Amplified"},
                {"roll": 6, "text": "Illusions Become Real"},
                {"roll": 7, "text": "Gravity Reverses Briefly"},
                {"roll": 8, "text": "Time Moves Differently"},
            ],
        },
        {
            "key": "danger",
            "label": "Danger",
            "dieSize": 8,
            "entries": [
                {"roll": 1, "text": "A Planar Predator Slips Through"},
                {"roll": 2, "text": "The Rift is Widening"},
                {"roll": 3, "text": "Something is Hunting the Rift"},
                {"roll": 4, "text": "Local Wildlife is Mutating"},
                {"roll": 5, "text": "A Cult is Guarding It"},
                {"roll": 6, "text": "It's Attracting Extraplanar Attention"},
                {"roll": 7, "text": "Touching It Has a Cost"},
                {"roll": 8, "text": "It's Unstable and Could Collapse"},
            ],
        },
    ],
}

# ============================================================
# Transcribed from random-table-images/Adventure-*.png (Dungeon Master's Guide, 2024)
# ============================================================

ADVENTURE_SITUATIONS_1_4 = {
    "name": "Adventure Situations (Levels 1-4)",
    "theme": "Adventures",
    "tags": ["adventure-hook", "dmg"],
    "description": "A single situation to seed a low-level adventure.",
    "source": "Dungeon Master's Guide (2024), image: Adventure-SituationsByLevel.png",
    "columns": [
        {
            "key": "situation",
            "label": "Situation",
            "dieSize": 20,
            "entries": [
                {"roll": 1, "text": "A dragon wyrmling has gathered a band of kobolds to help it amass a hoard."},
                {"roll": 2, "text": "Wererats living in a city's sewers plot to take control of the governing council."},
                {"roll": 3, "text": "Bandit activity signals efforts to revive an evil cult long ago driven from the region."},
                {"roll": 4, "text": "A pack of gnolls is rampaging dangerously close to local farmlands."},
                {"roll": 5, "text": "A rivalry between two merchant families escalates from mischief to mayhem."},
                {"roll": 6, "text": "A new sinkhole has revealed a long-buried dungeon thought to hold treasure."},
                {"roll": 7, "text": "Miners discovered an underground ruin and were captured by monsters living there."},
                {"roll": 8, "text": "An innocent person is being framed for the crimes of a shape-shifting monster."},
                {"roll": 9, "text": "Ghouls are venturing out of the catacombs at night."},
                {"roll": 10, "text": "A notorious criminal hides from the law in an old ruin or abandoned mine."},
                {"roll": 11, "text": "A contagion in a forest is causing spiders to grow massive and become aggressive."},
                {"roll": 12, "text": "To take revenge against a village for an imagined slight, a necromancer has been animating the corpses in the village cemetery."},
                {"roll": 13, "text": "An evil cult is spreading in a village. Those who oppose the cult are marked for sacrifice."},
                {"roll": 14, "text": "An abandoned house on the edge of town is haunted by Undead because of a cursed item in the house."},
                {"roll": 15, "text": "Creatures from the Feywild enter the world and cause mischief and misfortune among villagers and their livestock."},
                {"roll": 16, "text": "A hag's curse is making animals unusually aggressive."},
                {"roll": 17, "text": "Bullies have appointed themselves the village militia and are extorting money and food from villagers."},
                {"roll": 18, "text": "After a local fisher pulls a grotesque statue from the sea, aquatic monsters start attacking the waterfront at night."},
                {"roll": 19, "text": "The ruins on the hill near the village lie under a curse, so people don't go there - except a scholar who wants to study the ruins."},
                {"roll": 20, "text": "A new captain has taken charge of a band of pirates or bandits and started raiding more frequently."},
            ],
        },
    ],
}

ADVENTURE_SITUATIONS_5_10 = {
    "name": "Adventure Situations (Levels 5-10)",
    "theme": "Adventures",
    "tags": ["adventure-hook", "dmg"],
    "description": "A single situation to seed a mid-level adventure.",
    "source": "Dungeon Master's Guide (2024), image: Adventure-SituationsByLevel.png",
    "columns": [
        {
            "key": "situation",
            "label": "Situation",
            "dieSize": 20,
            "entries": [
                {"roll": 1, "text": "A group of cultists has summoned a demon to wreak havoc in the city."},
                {"roll": 2, "text": "A rebel lures monsters to the cause with the promise of looting the king's treasury."},
                {"roll": 3, "text": "An evil Artifact has transformed a forest into a dismal swamp full of horrific monsters."},
                {"roll": 4, "text": "An Aberration living in the Underdark sends minions to capture people from the surface to turn those people into new minions."},
                {"roll": 5, "text": "A monster (perhaps a devil, slaad, or hag) is impersonating a prominent noble to throw the realm into civil war."},
                {"roll": 6, "text": "A master thief plans to steal royal regalia."},
                {"roll": 7, "text": "A golem intended to serve as a protector has gone berserk and captured its creator."},
                {"roll": 8, "text": "A conspiracy of spies, assassins, and necromancers schemes to overthrow a ruler."},
                {"roll": 9, "text": "After establishing a lair, a young dragon is trying to earn the fear and respect of other creatures living nearby."},
                {"roll": 10, "text": "The approach of a lone giant alarms the people of a town, but the giant is simply looking for a place to live in peace."},
                {"roll": 11, "text": "An enormous monster on display in a menagerie breaks free and goes on a rampage."},
                {"roll": 12, "text": "A coven of hags steals cherished memories from travelers."},
                {"roll": 13, "text": "A villain seeks powerful magic in an ancient ruin, hoping to use it to conquer the region."},
                {"roll": 14, "text": "A scheming aristocrat hosts a masquerade ball, which many guests see as an opportunity to advance their own agendas. At least one shape-shifting monster also attends."},
                {"roll": 15, "text": "A ship carrying a valuable treasure or an evil Artifact sinks in a storm or monster attack."},
                {"roll": 16, "text": "A natural disaster was actually caused by magic gone awry or a cult's villainous plans."},
                {"roll": 17, "text": "A secretive cult uses spies to heighten tensions between two rival nations, hoping to provoke a war that will weaken both."},
                {"roll": 18, "text": "Rebels or forces of an enemy nation have kidnapped an important noble."},
                {"roll": 19, "text": "The descendants of a displaced people want to reclaim their ancestral city, which is now inhabited by monsters."},
                {"roll": 20, "text": "A renowned group of adventurers never returned from an expedition to a famous ruin."},
            ],
        },
    ],
}

ADVENTURE_SITUATIONS_11_16 = {
    "name": "Adventure Situations (Levels 11-16)",
    "theme": "Adventures",
    "tags": ["adventure-hook", "dmg"],
    "description": "A single situation to seed a high-level adventure.",
    "source": "Dungeon Master's Guide (2024), image: Adventure-SituationsByLevel2.png",
    "columns": [
        {
            "key": "situation",
            "label": "Situation",
            "dieSize": 12,
            "entries": [
                {"roll": 1, "text": "A portal to the Abyss opens in a cursed location and spews demons into the world."},
                {"roll": 2, "text": "A band of hunting giants has driven its prey - enormous beasts - into pastureland."},
                {"roll": 3, "text": "An adult dragon's lair is transforming an expanse into an environment inhospitable to the other creatures living there."},
                {"roll": 4, "text": "A long-lost journal describes an incredible journey to a hidden subterranean realm full of magical wonders."},
                {"roll": 5, "text": "Cultists hope to persuade a dragon to undergo the rite that will transform it into a dracolich."},
                {"roll": 6, "text": "The ruler of the realm is sending an emissary to a hostile neighbor to negotiate a truce, and the emissary needs protection."},
                {"roll": 7, "text": "A castle or city has been drawn into another plane of existence."},
                {"roll": 8, "text": "A storm tears across the land, with a mysterious flying citadel in the eye of the storm."},
                {"roll": 9, "text": "Two parts of a magic item are in the hands of bitter enemies; the third piece is lost."},
                {"roll": 10, "text": "Evil cultists gather from around the world to summon a monstrous god or alien entity."},
                {"roll": 11, "text": "A tyrannical ruler outlaws the use of magic without official sanction. A secret society of spellcasters seeks to oust the tyrant."},
                {"roll": 12, "text": "During a drought, low water levels in a lake reveal previously unknown ancient ruins that contain a powerful evil."},
            ],
        },
    ],
}

ADVENTURE_SITUATIONS_17_20 = {
    "name": "Adventure Situations (Levels 17-20)",
    "theme": "Adventures",
    "tags": ["adventure-hook", "dmg"],
    "description": "A single situation to seed an epic-level adventure.",
    "source": "Dungeon Master's Guide (2024), image: Adventure-SituationsByLevel2.png",
    "columns": [
        {
            "key": "situation",
            "label": "Situation",
            "dieSize": 10,
            "entries": [
                {"roll": 1, "text": "An ancient dragon is scheming to destroy a god and take the god's place in the pantheon. The dragon's minions are searching for Artifacts that can summon and weaken this god."},
                {"roll": 2, "text": "A band of giants drove away a metallic dragon and took over the dragon's lair, and the dragon wants to reclaim its lair."},
                {"roll": 3, "text": "An ancient hero returns from the dead to prepare the world for the return of an equally ancient monster."},
                {"roll": 4, "text": "An ancient Artifact has the power to defeat or imprison a rampaging titan."},
                {"roll": 5, "text": "A god of agriculture is angry, causing rivers to dry up and crops to wither."},
                {"roll": 6, "text": "An Artifact belonging to a god falls into mortal hands."},
                {"roll": 7, "text": "A titan imprisoned in the Underdark begins to break free, causing terrible earthquakes that are only a hint of the destruction that the titan will cause if it is released."},
                {"roll": 8, "text": "A lich tries to exterminate any spellcasters that approach the lich's level of power."},
                {"roll": 9, "text": "A holy temple was built around a portal leading to one of the Lower Planes to prevent evil from passing through in either direction. Now the temple has come under siege from both directions."},
                {"roll": 10, "text": "Five ancient metallic dragons lair in the Pillars of Creation. If all these dragons are killed, the world will collapse into chaos. One has just been slain."},
            ],
        },
    ],
}

PLANAR_ADVENTURE_SITUATIONS = {
    "name": "Planar Adventure Situations",
    "theme": "Adventures",
    "tags": ["adventure-hook", "dmg", "planar"],
    "description": "A single situation that draws the party into the Outer Planes.",
    "source": "Dungeon Master's Guide (2024), image: Adventure-Planar.png",
    "columns": [
        {
            "key": "situation",
            "label": "Situation",
            "dieSize": 10,
            "entries": [
                {"roll": 1, "text": "When magic fails to revive a dead person, the only solution is to venture to the Outer Planes to find the person's spirit and either release it from some prison or convince the person to return to life."},
                {"roll": 2, "text": "People who venture into the woods keep accidentally wandering into the Feywild or the Shadowfell. They might never return, return with no sense of how much time has passed, or return dramatically changed."},
                {"roll": 3, "text": "A long-dead oracle is the only one who knows how a terrible prophecy might be averted, but the cataclysmic fulfillment of the prophecy has already begun."},
                {"roll": 4, "text": "A god has stopped answering prayers and won't respond to any Commune spell."},
                {"roll": 5, "text": "A devil has tricked an angel into meddling in the Blood War, and the angel seeks mortal aid."},
                {"roll": 6, "text": "An ancestor of one of the characters must be convinced to bless the character before the full power of the character's bloodline can be unleashed."},
                {"roll": 7, "text": "A foolhardy knight carried a holy weapon on a doomed mission into the Nine Hells, and the powers of Mount Celestia want the weapon and the knight's remains retrieved."},
                {"roll": 8, "text": "A titan is imprisoned on an Outer Plane. The characters might be trying to stop those who seek to release it, or they might want to release it to help defend the world from a greater threat."},
                {"roll": 9, "text": "To prove themselves worthy of an even greater quest, the characters are sent to slay a horrible monster, win the favor of a powerful planar being, negotiate peace between two warring planar factions, or retrieve a long-lost item on another plane."},
                {"roll": 10, "text": "An item of legend is being sold at auction in Sigil, the City of Brass, or some other planar metropolis."},
            ],
        },
    ],
}

ADVENTURE_CLIMAX = {
    "name": "Adventure Climax",
    "theme": "Adventures",
    "tags": ["adventure-hook", "dmg"],
    "description": "A single idea for how an adventure's final confrontation plays out.",
    "source": "Dungeon Master's Guide (2024), image: Adventure-Climax.png",
    "columns": [
        {
            "key": "climax",
            "label": "Climax",
            "dieSize": 10,
            "entries": [
                {"roll": 1, "text": "The adventurers confront a villain and a group of minions in a battle to the finish."},
                {"roll": 2, "text": "The adventurers chase a villain while dodging obstacles designed to thwart them, leading to a final confrontation in the villain's refuge."},
                {"roll": 3, "text": "The actions of the adventurers or a villain result in a cataclysmic event that the adventurers must escape."},
                {"roll": 4, "text": "The adventurers race to the site where a villain is bringing a master plan to its conclusion, arriving just as that plan is about to be completed."},
                {"roll": 5, "text": "A villain and two or three lieutenants perform separate rites in a large room. The adventurers must disrupt all the rites."},
                {"roll": 6, "text": "An ally betrays the adventurers as they're about to achieve their goal. (Use this climax carefully, and don't overuse it.)"},
                {"roll": 7, "text": "A portal opens to another plane of existence. Creatures on the other side spill out, forcing the adventurers to close the portal while dealing with a villain at the same time."},
                {"roll": 8, "text": "The dungeon begins to collapse while a villain attempts to escape in the chaos."},
                {"roll": 9, "text": "The adventurers must choose whether to pursue a fleeing villain or save an NPC they care about or a group of innocents."},
                {"roll": 10, "text": "Just when the characters think the main threat is defeated, it transforms into a different monster or a more powerful form."},
            ],
        },
    ],
}

PATRON_HOOKS = {
    "name": "Patron Hooks",
    "theme": "Adventures",
    "tags": ["adventure-hook", "dmg"],
    "description": "Ways a patron NPC can lead the characters to an adventure situation.",
    "source": "Dungeon Master's Guide (2024), image: Adventure-Hooks.png",
    "columns": [
        {
            "key": "hook",
            "label": "Hook",
            "dieSize": 6,
            "entries": [
                {"roll": 1, "text": "A town crier announces that someone is hoping to hire adventurers."},
                {"roll": 2, "text": "Someone the characters want to impress or need a favor from asks them to deal with the adventure situation."},
                {"roll": 3, "text": "When the characters arrive in a new city, they find a job board where someone has posted in search of adventurers."},
                {"roll": 4, "text": "A wealthy patron who is aware of the adventurers' accomplishments writes to them, offering to pay them for their talents."},
                {"roll": 5, "text": "A citizen in need, who has learned of the adventurers' accomplishments and kindness, travels miles to find them and implore them for help."},
                {"roll": 6, "text": "The adventurers are arrested (on valid or invented charges) and offered a chance to escape punishment by completing a quest."},
            ],
        },
    ],
}

SUPERNATURAL_HOOKS = {
    "name": "Supernatural Hooks",
    "theme": "Adventures",
    "tags": ["adventure-hook", "dmg"],
    "description": "Omens and supernatural signs that point the characters toward an adventure situation.",
    "source": "Dungeon Master's Guide (2024), image: Adventure-Hooks.png",
    "columns": [
        {
            "key": "hook",
            "label": "Hook",
            "dieSize": 6,
            "entries": [
                {"roll": 1, "text": "The characters all have a vivid dream that foreshadows elements of the adventure."},
                {"roll": 2, "text": "While preparing spells, one character receives a quest from a god or patron."},
                {"roll": 3, "text": "A fortune teller's reading for one of the characters points to a quest and offers hints about challenges that lie ahead."},
                {"roll": 4, "text": "Flames, clouds, smoke, or huge flocks of birds take distinct shapes that portend the adventure situation."},
                {"roll": 5, "text": "Animals or animated objects speak clearly to direct the adventurers toward the situation."},
                {"roll": 6, "text": "Someone who died returns as a ghost and haunts the characters. The ghost prompts the characters to investigate the cause of the ghost's death and put it to rest."},
            ],
        },
    ],
}

HAPPENSTANCE_HOOKS = {
    "name": "Happenstance Hooks",
    "theme": "Adventures",
    "tags": ["adventure-hook", "dmg"],
    "description": "The characters just happen on an adventure through sheer coincidence - or at least what appears to be coincidence.",
    "source": "Dungeon Master's Guide (2024), image: Adventure-Hooks.png",
    "columns": [
        {
            "key": "hook",
            "label": "Hook",
            "dieSize": 6,
            "entries": [
                {"roll": 1, "text": "The characters find a letter describing the adventure situation."},
                {"roll": 2, "text": "The characters are on an unrelated quest, such as searching for a particular magic item, that leads them into the adventure situation."},
                {"roll": 3, "text": "The adventure situation disrupts a festival or ceremony that the characters are attending."},
                {"roll": 4, "text": "A magical mishap places the characters in the adventure situation."},
                {"roll": 5, "text": "While traveling in a caravan or aboard a ship, the characters befriend an NPC who has news about the adventure situation."},
                {"roll": 6, "text": "The characters are attacked after being mistaken for another group of adventurers. They learn about the adventure situation from a clue left behind by their attackers."},
            ],
        },
    ],
}

# ============================================================
# Transcribed from random-table-images/Treasure-*.png (Dungeon Master's Guide, 2024) -
# these are keyed by Challenge Rating rather than an independent die roll; see module
# docstring for how `roll`/`dieSize` are adapted for that shape.
# ============================================================

INDIVIDUAL_TREASURE = {
    "name": "Individual Treasure",
    "theme": "Loot",
    "tags": ["treasure", "dmg"],
    "description": (
        "How much treasure a single monster carries, by its Challenge Rating (average total "
        "in parentheses - use it instead of rolling). To find a group's total, roll once and "
        "multiply by the number of creatures. This is a lookup by CR, not an independent "
        "random roll - dieSize is 0 and each entry's CR band is folded into its text."
    ),
    "source": "Dungeon Master's Guide (2024), image: Treasure-Individual.png",
    "columns": [
        {
            "key": "treasure",
            "label": "Individual Treasure (by CR)",
            "dieSize": 0,
            "entries": [
                {"roll": 1, "text": "CR 0-4: 3d6 (10) GP"},
                {"roll": 2, "text": "CR 5-10: 2d8 x 10 (90) GP"},
                {"roll": 3, "text": "CR 11-16: 2d10 x 10 (110) PP"},
                {"roll": 4, "text": "CR 17+: 2d8 x 100 (900) PP"},
            ],
        },
    ],
}

TREASURE_HORDE = {
    "name": "Random Treasure Hoard",
    "theme": "Loot",
    "tags": ["treasure", "dmg"],
    "description": (
        "A hoard for a group or lair, by the leading monster's Challenge Rating (average "
        "totals in parentheses - use instead of rolling). For a monster especially fond of "
        "amassing treasure, roll twice and double the total. Both columns below are keyed "
        "by the same CR band - read across the same row index in each rather than rolling "
        "them independently. dieSize is 0 since this is a lookup by CR, not a random roll."
    ),
    "source": "Dungeon Master's Guide (2024), image: Treasure-Horde.png",
    "columns": [
        {
            "key": "monetary_treasure",
            "label": "Monetary Treasure (by CR)",
            "dieSize": 0,
            "entries": [
                {"roll": 1, "text": "CR 0-4: 2d4 x 100 (500) GP"},
                {"roll": 2, "text": "CR 5-10: 8d10 x 100 (4,400) GP"},
                {"roll": 3, "text": "CR 11-16: 8d8 x 10,000 (36,000) GP"},
                {"roll": 4, "text": "CR 17+: 6d10 x 10,000 (330,000) GP"},
            ],
        },
        {
            "key": "magic_items",
            "label": "Magic Items (by CR)",
            "dieSize": 0,
            "entries": [
                {"roll": 1, "text": "CR 0-4: 1d4 - 1"},
                {"roll": 2, "text": "CR 5-10: 1d3"},
                {"roll": 3, "text": "CR 11-16: 1d4"},
                {"roll": 4, "text": "CR 17+: 1d6"},
            ],
        },
    ],
}

ALL_TABLES = [
    DARKWOOD_FOREST,
    RUSTY_ANCHOR_TAVERN,
    MARKET_STREET,
    FORGOTTEN_CORRIDOR,
    PLANAR_RIFT,
    ADVENTURE_SITUATIONS_1_4,
    ADVENTURE_SITUATIONS_5_10,
    ADVENTURE_SITUATIONS_11_16,
    ADVENTURE_SITUATIONS_17_20,
    PLANAR_ADVENTURE_SITUATIONS,
    ADVENTURE_CLIMAX,
    PATRON_HOOKS,
    SUPERNATURAL_HOOKS,
    HAPPENSTANCE_HOOKS,
    INDIVIDUAL_TREASURE,
    TREASURE_HORDE,
]


async def main() -> None:
    conn = await asyncpg.connect(
        host=os.environ.get("WW_DB_HOST", "localhost"),
        port=int(os.environ.get("WW_DB_PORT", "5432")),
        database=os.environ.get("WW_DB_NAME", "WorldWatcher_DB"),
        user=os.environ.get("WW_DB_USER", "postgres"),
        password=os.environ.get("WW_DB_PASSWORD", ""),
    )
    try:
        existing = await conn.fetchval("SELECT count(*) FROM situational_tables")
        if existing == 0:
            for table in ALL_TABLES:
                await conn.execute(
                    """
                    INSERT INTO situational_tables (name, theme, tags, description, source, columns)
                    VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb)
                    """,
                    table["name"],
                    table["theme"],
                    json.dumps(table["tags"]),
                    table["description"],
                    table["source"],
                    json.dumps(table["columns"]),
                )
        print(f"situational_tables: {'seeded' if existing == 0 else 'already seeded'} ({len(ALL_TABLES)} tables)")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
