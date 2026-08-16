import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class SpellRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source_id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    name: str
    slug: str
    edition: Optional[str] = None
    level: int
    school: Optional[str] = None
    casting_time: Optional[str] = None
    range: Optional[str] = None
    duration: Optional[str] = None
    concentration: bool
    ritual: bool
    components_display: Optional[str] = None
    components: Optional[Any] = None
    classes_display: Optional[str] = None
    classes: Optional[Any] = None
    description: Optional[str] = None
    area: Optional[Any] = None
    damage: Optional[Any] = None
    saving_throw: Optional[Any] = None
    effects: Optional[Any] = None
    mechanics: Optional[Any] = None
    image_asset_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


class SpellDetail(SpellRead):
    raw_data: Optional[Any] = None


class SpellCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    source_id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    name: str
    slug: str
    edition: Optional[str] = None
    level: int
    school: Optional[str] = None
    casting_time: Optional[str] = None
    range: Optional[str] = None
    duration: Optional[str] = None
    concentration: bool = False
    ritual: bool = False
    components_display: Optional[str] = None
    components: Optional[Any] = None
    classes_display: Optional[str] = None
    classes: Optional[Any] = None
    description: Optional[str] = None
    area: Optional[Any] = None
    damage: Optional[Any] = None
    saving_throw: Optional[Any] = None
    effects: Optional[Any] = None
    mechanics: Optional[Any] = None
    image_asset_id: Optional[uuid.UUID] = None
    raw_data: Optional[Any] = None


class SpellUpdate(BaseModel):
    source_id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    slug: Optional[str] = None
    edition: Optional[str] = None
    level: Optional[int] = None
    school: Optional[str] = None
    casting_time: Optional[str] = None
    range: Optional[str] = None
    duration: Optional[str] = None
    concentration: Optional[bool] = None
    ritual: Optional[bool] = None
    components_display: Optional[str] = None
    components: Optional[Any] = None
    classes_display: Optional[str] = None
    classes: Optional[Any] = None
    description: Optional[str] = None
    area: Optional[Any] = None
    damage: Optional[Any] = None
    saving_throw: Optional[Any] = None
    effects: Optional[Any] = None
    mechanics: Optional[Any] = None
    image_asset_id: Optional[uuid.UUID] = None
    raw_data: Optional[Any] = None
