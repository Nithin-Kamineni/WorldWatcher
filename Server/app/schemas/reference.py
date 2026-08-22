import uuid
from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

SourceType = Literal["core", "supplement", "adventure", "homebrew", "srd", "unearthed_arcana"]
AssetType = Literal[
    "creature_portrait", "creature_token", "item_image", "map", "npc_portrait",
    "faction_image", "location_image", "spell_image", "character_portrait",
    "character_token", "other",
]
ConditionType = Literal["condition", "disease", "status"]
EffectType = Literal[
    "DAMAGE", "HEAL", "CONDITION", "REMOVE_CONDITION", "MODIFIER", "MOVEMENT", "TELEPORT",
    "SUMMON", "BANISH", "DISPEL", "CREATE_AOE", "DESTROY_AOE", "GRANT_ADVANTAGE",
    "GRANT_DISADVANTAGE", "CUSTOM",
]


class SourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    abbreviation: str
    edition: Optional[str] = None
    source_type: str
    publisher: Optional[str] = None
    publication_date: Optional[date] = None
    page: Optional[int] = None
    license: Optional[str] = None
    description: Optional[str] = None
    raw_data: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class SourceCreate(BaseModel):
    name: str
    abbreviation: str
    edition: Optional[str] = None
    source_type: SourceType
    publisher: Optional[str] = None
    publication_date: Optional[date] = None
    page: Optional[int] = None
    license: Optional[str] = None
    description: Optional[str] = None
    raw_data: Optional[Any] = None


class SourceUpdate(BaseModel):
    name: Optional[str] = None
    abbreviation: Optional[str] = None
    edition: Optional[str] = None
    source_type: Optional[SourceType] = None
    publisher: Optional[str] = None
    publication_date: Optional[date] = None
    page: Optional[int] = None
    license: Optional[str] = None
    description: Optional[str] = None
    raw_data: Optional[Any] = None


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    filename: str
    storage_path: str
    asset_type: str
    mime_type: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    file_size: Optional[int] = None
    sha256: str
    source: Optional[str] = None
    source_path: Optional[str] = None
    raw_data: Optional[Any] = None
    created_at: datetime
    url: Optional[str] = None


class AssetUpdate(BaseModel):
    filename: Optional[str] = None
    asset_type: Optional[AssetType] = None
    raw_data: Optional[Any] = None


class ConditionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source_id: Optional[uuid.UUID] = None
    name: str
    condition_type: Optional[str] = None
    description: Optional[str] = None
    raw_data: Optional[Any] = None


class ConditionCreate(BaseModel):
    source_id: Optional[uuid.UUID] = None
    name: str
    condition_type: Optional[ConditionType] = None
    description: Optional[str] = None
    raw_data: Optional[Any] = None


class ConditionUpdate(BaseModel):
    source_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    condition_type: Optional[ConditionType] = None
    description: Optional[str] = None
    raw_data: Optional[Any] = None


class EffectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: Optional[uuid.UUID] = None
    name: str
    effect_type: str
    condition_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    mechanics: Optional[Any] = None
    raw_data: Optional[Any] = None


class EffectCreate(BaseModel):
    campaign_id: Optional[uuid.UUID] = None
    name: str
    effect_type: EffectType = "CUSTOM"
    condition_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    mechanics: Optional[Any] = None
    raw_data: Optional[Any] = None


class EffectUpdate(BaseModel):
    campaign_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    effect_type: Optional[EffectType] = None
    condition_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    mechanics: Optional[Any] = None
    raw_data: Optional[Any] = None


RandomNameType = Literal["first", "last"]


class RandomNameRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    name_type: RandomNameType


class RandomProfessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


class RandomMotivationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    text: str


class RandomPitfallRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    text: str
