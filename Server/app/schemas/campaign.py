import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

CharacterType = Literal["pc", "companion", "hireling", "other"]
LocationType = Literal["continent", "country", "region", "city", "district", "building", "room", "dungeon", "other"]
QuestStatus = Literal["not_started", "active", "completed", "failed", "abandoned"]


class CampaignRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
    ruleset: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
    ruleset: Optional[str] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
    ruleset: Optional[str] = None


class CharacterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    name: str
    character_type: str
    level: Optional[int] = None
    class_: Optional[str] = None
    subclass: Optional[str] = None
    species: Optional[str] = None
    background: Optional[str] = None
    current_hp: Optional[int] = None
    max_hp: Optional[int] = None
    temporary_hp: int
    armor_class: Optional[int] = None
    strength: Optional[int] = None
    dexterity: Optional[int] = None
    constitution: Optional[int] = None
    intelligence: Optional[int] = None
    wisdom: Optional[int] = None
    charisma: Optional[int] = None
    skills: Optional[Any] = None
    saving_throws: Optional[Any] = None
    resources: Optional[Any] = None
    equipment: Optional[Any] = None
    features: Optional[Any] = None
    notes: Optional[str] = None
    portrait_asset_id: Optional[uuid.UUID] = None
    token_asset_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


class CharacterCreate(BaseModel):
    campaign_id: uuid.UUID
    name: str
    character_type: CharacterType = "pc"
    level: Optional[int] = None
    class_: Optional[str] = None
    subclass: Optional[str] = None
    species: Optional[str] = None
    background: Optional[str] = None
    current_hp: Optional[int] = None
    max_hp: Optional[int] = None
    temporary_hp: int = 0
    armor_class: Optional[int] = None
    strength: Optional[int] = None
    dexterity: Optional[int] = None
    constitution: Optional[int] = None
    intelligence: Optional[int] = None
    wisdom: Optional[int] = None
    charisma: Optional[int] = None
    skills: Optional[Any] = None
    saving_throws: Optional[Any] = None
    resources: Optional[Any] = None
    equipment: Optional[Any] = None
    features: Optional[Any] = None
    notes: Optional[str] = None
    portrait_asset_id: Optional[uuid.UUID] = None
    token_asset_id: Optional[uuid.UUID] = None


class CharacterUpdate(BaseModel):
    campaign_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    character_type: Optional[CharacterType] = None
    level: Optional[int] = None
    class_: Optional[str] = None
    subclass: Optional[str] = None
    species: Optional[str] = None
    background: Optional[str] = None
    current_hp: Optional[int] = None
    max_hp: Optional[int] = None
    temporary_hp: Optional[int] = None
    armor_class: Optional[int] = None
    strength: Optional[int] = None
    dexterity: Optional[int] = None
    constitution: Optional[int] = None
    intelligence: Optional[int] = None
    wisdom: Optional[int] = None
    charisma: Optional[int] = None
    skills: Optional[Any] = None
    saving_throws: Optional[Any] = None
    resources: Optional[Any] = None
    equipment: Optional[Any] = None
    features: Optional[Any] = None
    notes: Optional[str] = None
    portrait_asset_id: Optional[uuid.UUID] = None
    token_asset_id: Optional[uuid.UUID] = None


class LocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    parent_location_id: Optional[uuid.UUID] = None
    name: str
    location_type: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    map_id: Optional[uuid.UUID] = None
    image_asset_id: Optional[uuid.UUID] = None
    raw_data: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class LocationCreate(BaseModel):
    campaign_id: uuid.UUID
    parent_location_id: Optional[uuid.UUID] = None
    name: str
    location_type: Optional[LocationType] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    map_id: Optional[uuid.UUID] = None
    image_asset_id: Optional[uuid.UUID] = None
    raw_data: Optional[Any] = None


class LocationUpdate(BaseModel):
    campaign_id: Optional[uuid.UUID] = None
    parent_location_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    location_type: Optional[LocationType] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    map_id: Optional[uuid.UUID] = None
    image_asset_id: Optional[uuid.UUID] = None
    raw_data: Optional[Any] = None


FactionRelationType = Literal["ally", "trade", "peace", "neutral", "war", "enemy"]


class FactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    name: str
    description: Optional[str] = None
    faction_type: Optional[str] = None
    goals: Optional[Any] = None
    beliefs: Optional[Any] = None
    resources: Optional[Any] = None
    locations: Optional[Any] = None
    members: Optional[Any] = None
    notes: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
    governance: Optional[str] = None
    power: int
    power_label: Optional[str] = None
    location_summary: Optional[str] = None
    military: int
    naval: int
    economy: int
    reputation: int
    raw_data: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class FactionCreate(BaseModel):
    campaign_id: uuid.UUID
    name: str
    description: Optional[str] = None
    faction_type: Optional[str] = None
    goals: Optional[Any] = None
    beliefs: Optional[Any] = None
    resources: Optional[Any] = None
    locations: Optional[Any] = None
    members: Optional[Any] = None
    notes: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
    governance: Optional[str] = None
    power: int = 1
    power_label: Optional[str] = None
    location_summary: Optional[str] = None
    military: int = 30
    naval: int = 30
    economy: int = 30
    reputation: int = 30
    raw_data: Optional[Any] = None


class FactionUpdate(BaseModel):
    campaign_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    faction_type: Optional[str] = None
    goals: Optional[Any] = None
    beliefs: Optional[Any] = None
    resources: Optional[Any] = None
    locations: Optional[Any] = None
    members: Optional[Any] = None
    notes: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
    governance: Optional[str] = None
    power: Optional[int] = None
    power_label: Optional[str] = None
    location_summary: Optional[str] = None
    military: Optional[int] = None
    naval: Optional[int] = None
    economy: Optional[int] = None
    reputation: Optional[int] = None
    raw_data: Optional[Any] = None


class FactionRelationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    faction_a_id: uuid.UUID
    faction_b_id: uuid.UUID
    relation_type: FactionRelationType
    strength: int
    treaties: Optional[Any] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class FactionRelationCreate(BaseModel):
    campaign_id: uuid.UUID
    faction_a_id: uuid.UUID
    faction_b_id: uuid.UUID
    relation_type: FactionRelationType = "neutral"
    strength: int = 40
    treaties: Optional[Any] = None
    notes: Optional[str] = None


class FactionRelationUpdate(BaseModel):
    relation_type: Optional[FactionRelationType] = None
    strength: Optional[int] = None
    treaties: Optional[Any] = None
    notes: Optional[str] = None


class RandomEncounterTableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    name: str
    die_expression: str
    entries: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class RandomEncounterTableCreate(BaseModel):
    campaign_id: uuid.UUID
    name: str
    die_expression: str = "1d8"
    entries: Optional[Any] = None


class RandomEncounterTableUpdate(BaseModel):
    campaign_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    die_expression: Optional[str] = None
    entries: Optional[Any] = None


class QuestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    name: str
    description: Optional[str] = None
    status: str
    quest_giver_character_id: Optional[uuid.UUID] = None
    quest_giver_creature_id: Optional[uuid.UUID] = None
    related_faction_ids: Optional[Any] = None
    related_location_ids: Optional[Any] = None
    objectives: Optional[Any] = None
    rewards: Optional[Any] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class QuestCreate(BaseModel):
    campaign_id: uuid.UUID
    name: str
    description: Optional[str] = None
    status: QuestStatus = "not_started"
    quest_giver_character_id: Optional[uuid.UUID] = None
    quest_giver_creature_id: Optional[uuid.UUID] = None
    related_faction_ids: Optional[Any] = None
    related_location_ids: Optional[Any] = None
    objectives: Optional[Any] = None
    rewards: Optional[Any] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None


class QuestUpdate(BaseModel):
    campaign_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[QuestStatus] = None
    quest_giver_character_id: Optional[uuid.UUID] = None
    quest_giver_creature_id: Optional[uuid.UUID] = None
    related_faction_ids: Optional[Any] = None
    related_location_ids: Optional[Any] = None
    objectives: Optional[Any] = None
    rewards: Optional[Any] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None
