"""Import every model so they register on Base.metadata for Alembic autogenerate."""
from app.models.bastions import Bastion, BastionFacility, BastionFacilityInstance
from app.models.campaign import (
    Campaign,
    Character,
    Faction,
    FactionRelation,
    Location,
    Quest,
    RandomEncounterTable,
)
from app.models.combat import Combat, Combatant
from app.models.creatures import Creature, CreatureAction
from app.models.encounters import Encounter, EncounterCreature, EncounterTable, EncounterTableCreature
from app.models.items import Item
from app.models.maps import Map, MapFloor, MapShape, MapToken, TokenLibrary
from app.models.raw_entity import RawEntity
from app.models.reference import (
    Asset,
    Condition,
    Effect,
    RandomMotivation,
    RandomName,
    RandomPitfall,
    RandomProfession,
    Source,
)
from app.models.spells import Spell

__all__ = [
    "Source",
    "Asset",
    "Condition",
    "Effect",
    "RandomName",
    "RandomProfession",
    "RandomMotivation",
    "RandomPitfall",
    "Creature",
    "CreatureAction",
    "Spell",
    "Item",
    "Campaign",
    "Character",
    "Location",
    "Faction",
    "FactionRelation",
    "Quest",
    "RandomEncounterTable",
    "Map",
    "MapFloor",
    "TokenLibrary",
    "MapToken",
    "MapShape",
    "Encounter",
    "EncounterCreature",
    "EncounterTable",
    "EncounterTableCreature",
    "Combat",
    "Combatant",
    "RawEntity",
    "BastionFacility",
    "Bastion",
    "BastionFacilityInstance",
]
