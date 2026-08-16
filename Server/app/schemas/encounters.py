import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class EncounterCreatureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    encounter_id: uuid.UUID
    creature_id: Optional[uuid.UUID] = None
    custom_name: Optional[str] = None
    custom_image_asset_id: Optional[uuid.UUID] = None
    quantity: int
    size_override: Optional[float] = None
    sort_order: int
    raw_data: Optional[Any] = None


class EncounterCreatureCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    creature_id: Optional[uuid.UUID] = None
    custom_name: Optional[str] = None
    custom_image_asset_id: Optional[uuid.UUID] = None
    quantity: int = 1
    size_override: Optional[float] = None
    sort_order: int = 0
    raw_data: Optional[Any] = None


class EncounterCreatureUpdate(BaseModel):
    creature_id: Optional[uuid.UUID] = None
    custom_name: Optional[str] = None
    custom_image_asset_id: Optional[uuid.UUID] = None
    quantity: Optional[int] = None
    size_override: Optional[float] = None
    sort_order: Optional[int] = None
    raw_data: Optional[Any] = None


class EncounterTableCreatureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    encounter_table_id: uuid.UUID
    creature_id: Optional[uuid.UUID] = None
    creature_name_raw: str
    quantity_formula: str
    sort_order: int
    # Denormalized from a join against creatures at read time (not stored columns)
    # so the client can show a real name/type without fetching the whole bestiary.
    creature_name: Optional[str] = None
    creature_type: Optional[str] = None


class EncounterTableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    encounter_id: uuid.UUID
    dice_expression: Optional[str] = None
    min_level: Optional[int] = None
    max_level: Optional[int] = None
    min: int
    max: int
    result_text: Optional[str] = None
    sort_order: int
    creatures: list[EncounterTableCreatureRead] = []


class EncounterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: Optional[uuid.UUID] = None
    map_id: Optional[uuid.UUID] = None
    source_id: Optional[uuid.UUID] = None
    page: Optional[int] = None
    resolution_type: str = "fixed"
    tables: Optional[Any] = None
    name: str
    description: Optional[str] = None
    challenge_rating_display: Optional[str] = None
    computed_adjusted_xp: Optional[int] = None
    computed_cr: Optional[str] = None
    difficulty: Optional[str] = None
    theme: Optional[str] = None
    encounter_type: Optional[str] = None
    possible_locations: Optional[list[str]] = None
    environment: Optional[str] = None
    tags: list[str] = []
    starting_positions: Optional[Any] = None
    special_rules: Optional[Any] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class EncounterDetail(EncounterRead):
    creatures: list[EncounterCreatureRead] = []
    random_tables: list[EncounterTableRead] = []


class EncounterCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    map_id: Optional[uuid.UUID] = None
    source_id: Optional[uuid.UUID] = None
    page: Optional[int] = None
    resolution_type: str = "fixed"
    tables: Optional[Any] = None
    name: str
    description: Optional[str] = None
    challenge_rating_display: Optional[str] = None
    computed_adjusted_xp: Optional[int] = None
    computed_cr: Optional[str] = None
    difficulty: Optional[str] = None
    theme: Optional[str] = None
    encounter_type: Optional[str] = None
    possible_locations: Optional[list[str]] = None
    environment: Optional[str] = None
    tags: list[str] = []
    starting_positions: Optional[Any] = None
    special_rules: Optional[Any] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None


class EncounterUpdate(BaseModel):
    campaign_id: Optional[uuid.UUID] = None
    map_id: Optional[uuid.UUID] = None
    source_id: Optional[uuid.UUID] = None
    page: Optional[int] = None
    resolution_type: Optional[str] = None
    tables: Optional[Any] = None
    name: Optional[str] = None
    description: Optional[str] = None
    challenge_rating_display: Optional[str] = None
    computed_adjusted_xp: Optional[int] = None
    computed_cr: Optional[str] = None
    difficulty: Optional[str] = None
    theme: Optional[str] = None
    encounter_type: Optional[str] = None
    possible_locations: Optional[list[str]] = None
    environment: Optional[str] = None
    tags: Optional[list[str]] = None
    starting_positions: Optional[Any] = None
    special_rules: Optional[Any] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None
