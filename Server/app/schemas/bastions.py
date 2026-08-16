import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

FacilityType = Literal["basic", "special"]
BastionFacilityInstanceStatus = Literal["under_construction", "built", "decommissioned"]


class BastionFacilityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source_id: Optional[uuid.UUID] = None
    name: str
    slug: str
    facility_type: FacilityType
    space: Optional[Any] = None
    prerequisite_level: Optional[int] = None
    hirelings: Optional[Any] = None
    orders: Optional[Any] = None
    description: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
    page: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class BastionFacilityDetail(BastionFacilityRead):
    raw_data: Optional[Any] = None


class BastionFacilityCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    source_id: Optional[uuid.UUID] = None
    name: str
    slug: str
    facility_type: FacilityType = "basic"
    space: Optional[Any] = None
    prerequisite_level: Optional[int] = None
    hirelings: Optional[Any] = None
    orders: Optional[Any] = None
    description: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
    page: Optional[int] = None
    raw_data: Optional[Any] = None


class BastionFacilityUpdate(BaseModel):
    source_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    slug: Optional[str] = None
    facility_type: Optional[FacilityType] = None
    space: Optional[Any] = None
    prerequisite_level: Optional[int] = None
    hirelings: Optional[Any] = None
    orders: Optional[Any] = None
    description: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
    page: Optional[int] = None
    raw_data: Optional[Any] = None


class BastionFacilityInstanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    bastion_id: uuid.UUID
    facility_id: Optional[uuid.UUID] = None
    custom_name: Optional[str] = None
    status: BastionFacilityInstanceStatus
    defenders_assigned: int
    pending_order: Optional[Any] = None
    notes: Optional[str] = None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class BastionFacilityInstanceCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    facility_id: Optional[uuid.UUID] = None
    custom_name: Optional[str] = None
    status: BastionFacilityInstanceStatus = "built"
    defenders_assigned: int = 0
    pending_order: Optional[Any] = None
    notes: Optional[str] = None
    sort_order: int = 0


class BastionFacilityInstanceUpdate(BaseModel):
    facility_id: Optional[uuid.UUID] = None
    custom_name: Optional[str] = None
    status: Optional[BastionFacilityInstanceStatus] = None
    defenders_assigned: Optional[int] = None
    pending_order: Optional[Any] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


class BastionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    character_id: Optional[uuid.UUID] = None
    name: str
    notes: Optional[str] = None
    treasury: int
    raw_data: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class BastionDetail(BastionRead):
    facilities: list[BastionFacilityInstanceRead] = []


class BastionCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    campaign_id: uuid.UUID
    character_id: Optional[uuid.UUID] = None
    name: str
    notes: Optional[str] = None
    treasury: int = 0
    raw_data: Optional[Any] = None


class BastionUpdate(BaseModel):
    campaign_id: Optional[uuid.UUID] = None
    character_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    notes: Optional[str] = None
    treasury: Optional[int] = None
    raw_data: Optional[Any] = None
