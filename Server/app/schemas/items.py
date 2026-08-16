import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

Rarity = Literal["common", "uncommon", "rare", "very-rare", "legendary", "artifact", "unknown", "varies"]


class ItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source_id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    name: str
    slug: str
    edition: Optional[str] = None
    item_type: Optional[str] = None
    rarity: str
    requires_attunement: bool
    attunement_requirement: Optional[str] = None
    weight: Optional[float] = None
    cost: Optional[Any] = None
    description: Optional[str] = None
    properties: Optional[Any] = None
    effects: Optional[Any] = None
    charges: Optional[Any] = None
    image_asset_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


class ItemDetail(ItemRead):
    raw_data: Optional[Any] = None


class ItemCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    source_id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    name: str
    slug: str
    edition: Optional[str] = None
    item_type: Optional[str] = None
    rarity: Rarity
    requires_attunement: bool = False
    attunement_requirement: Optional[str] = None
    weight: Optional[float] = None
    cost: Optional[Any] = None
    description: Optional[str] = None
    properties: Optional[Any] = None
    effects: Optional[Any] = None
    charges: Optional[Any] = None
    image_asset_id: Optional[uuid.UUID] = None
    raw_data: Optional[Any] = None


class ItemUpdate(BaseModel):
    source_id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    slug: Optional[str] = None
    edition: Optional[str] = None
    item_type: Optional[str] = None
    rarity: Optional[Rarity] = None
    requires_attunement: Optional[bool] = None
    attunement_requirement: Optional[str] = None
    weight: Optional[float] = None
    cost: Optional[Any] = None
    description: Optional[str] = None
    properties: Optional[Any] = None
    effects: Optional[Any] = None
    charges: Optional[Any] = None
    image_asset_id: Optional[uuid.UUID] = None
    raw_data: Optional[Any] = None
