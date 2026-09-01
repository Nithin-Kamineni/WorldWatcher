import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class WorldRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


class WorldCreate(BaseModel):
    name: str
    description: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None


class WorldUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
