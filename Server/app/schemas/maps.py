import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

Setting = Literal["indoor", "outdoor", "both"]
GridType = Literal["square", "hex"]
ShapeType = Literal["circle", "cone", "square", "rectangle", "line", "thin-line", "freehand"]


class MapRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    location_id: Optional[uuid.UUID] = None
    name: str
    description: Optional[str] = None
    map_kinds: list[str] = []
    map_location_text: Optional[str] = None
    setting: Optional[str] = None
    activity: Optional[str] = None
    grid_enabled: bool
    grid_size: int
    grid_color: str
    grid_thickness: int
    grid_type: str
    primary_floor_id: Optional[uuid.UUID] = None
    settings: Optional[Any] = None
    raw_data: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class MapCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    campaign_id: uuid.UUID
    location_id: Optional[uuid.UUID] = None
    name: str
    description: Optional[str] = None
    map_kinds: list[str] = []
    map_location_text: Optional[str] = None
    setting: Optional[Setting] = None
    activity: Optional[str] = None
    grid_enabled: bool = False
    grid_size: int = 70
    grid_color: str = "rgba(128,128,128,0.35)"
    grid_thickness: int = 1
    grid_type: GridType = "square"
    primary_floor_id: Optional[uuid.UUID] = None
    settings: Optional[Any] = None
    raw_data: Optional[Any] = None


class MapUpdate(BaseModel):
    campaign_id: Optional[uuid.UUID] = None
    location_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    map_kinds: Optional[list[str]] = None
    map_location_text: Optional[str] = None
    setting: Optional[Setting] = None
    activity: Optional[str] = None
    grid_enabled: Optional[bool] = None
    grid_size: Optional[int] = None
    grid_color: Optional[str] = None
    grid_thickness: Optional[int] = None
    grid_type: Optional[GridType] = None
    primary_floor_id: Optional[uuid.UUID] = None
    settings: Optional[Any] = None
    raw_data: Optional[Any] = None


class MapFloorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    map_id: uuid.UUID
    name: str
    sort_order: int
    background_asset_id: uuid.UUID
    width: Optional[int] = None
    height: Optional[int] = None
    flipped_horizontal: bool
    flipped_vertical: bool
    rotation: int
    locked_encounter_id: Optional[uuid.UUID] = None
    walls: Optional[Any] = None
    doors: Optional[Any] = None
    lighting: Optional[Any] = None
    terrain: Optional[Any] = None
    raw_data: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class MapFloorCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    map_id: Optional[uuid.UUID] = None
    name: str
    sort_order: int = 0
    background_asset_id: uuid.UUID
    width: Optional[int] = None
    height: Optional[int] = None
    flipped_horizontal: bool = False
    flipped_vertical: bool = False
    rotation: int = 0
    locked_encounter_id: Optional[uuid.UUID] = None
    walls: Optional[Any] = None
    doors: Optional[Any] = None
    lighting: Optional[Any] = None
    terrain: Optional[Any] = None
    raw_data: Optional[Any] = None


class MapFloorUpdate(BaseModel):
    map_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    sort_order: Optional[int] = None
    background_asset_id: Optional[uuid.UUID] = None
    width: Optional[int] = None
    height: Optional[int] = None
    flipped_horizontal: Optional[bool] = None
    flipped_vertical: Optional[bool] = None
    rotation: Optional[int] = None
    locked_encounter_id: Optional[uuid.UUID] = None
    walls: Optional[Any] = None
    doors: Optional[Any] = None
    lighting: Optional[Any] = None
    terrain: Optional[Any] = None
    raw_data: Optional[Any] = None


class TokenLibraryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: Optional[uuid.UUID] = None
    name: str
    image_asset_id: uuid.UUID
    is_favorite: bool
    default_size: float
    current_size: float
    raw_data: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class TokenLibraryCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    name: str
    image_asset_id: uuid.UUID
    is_favorite: bool = False
    default_size: float = 1
    current_size: float = 1
    raw_data: Optional[Any] = None


class TokenLibraryUpdate(BaseModel):
    campaign_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
    is_favorite: Optional[bool] = None
    default_size: Optional[float] = None
    current_size: Optional[float] = None
    raw_data: Optional[Any] = None


class MapTokenRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    map_floor_id: uuid.UUID
    token_definition_id: Optional[uuid.UUID] = None
    creature_id: Optional[uuid.UUID] = None
    character_id: Optional[uuid.UUID] = None
    encounter_creature_id: Optional[uuid.UUID] = None
    name: str
    image_asset_id: Optional[uuid.UUID] = None
    x: float
    y: float
    size: float
    outline_color: str
    current_hp: Optional[int] = None
    max_hp: Optional[int] = None
    concentrating: bool
    death_save_successes: int
    death_save_failures: int
    effects: Any = []
    notes: Optional[str] = None
    raw_data: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class MapTokenCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    map_floor_id: Optional[uuid.UUID] = None
    token_definition_id: Optional[uuid.UUID] = None
    creature_id: Optional[uuid.UUID] = None
    character_id: Optional[uuid.UUID] = None
    encounter_creature_id: Optional[uuid.UUID] = None
    name: str
    image_asset_id: Optional[uuid.UUID] = None
    x: float
    y: float
    size: float
    outline_color: str = "#f5c542"
    current_hp: Optional[int] = None
    max_hp: Optional[int] = None
    concentrating: bool = False
    death_save_successes: int = 0
    death_save_failures: int = 0
    effects: Any = []
    notes: Optional[str] = None
    raw_data: Optional[Any] = None


class MapTokenUpdate(BaseModel):
    map_floor_id: Optional[uuid.UUID] = None
    token_definition_id: Optional[uuid.UUID] = None
    creature_id: Optional[uuid.UUID] = None
    character_id: Optional[uuid.UUID] = None
    encounter_creature_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    image_asset_id: Optional[uuid.UUID] = None
    x: Optional[float] = None
    y: Optional[float] = None
    size: Optional[float] = None
    outline_color: Optional[str] = None
    current_hp: Optional[int] = None
    max_hp: Optional[int] = None
    concentrating: Optional[bool] = None
    death_save_successes: Optional[int] = None
    death_save_failures: Optional[int] = None
    effects: Optional[Any] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None


class MapShapeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    map_floor_id: uuid.UUID
    shape_type: str
    x: float
    y: float
    radius: Optional[float] = None
    rotation: float
    width: Optional[float] = None
    height: Optional[float] = None
    points: Optional[Any] = None
    color: str
    stroke_width: Optional[float] = None
    raw_data: Optional[Any] = None
    created_at: datetime


class MapShapeCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    map_floor_id: Optional[uuid.UUID] = None
    shape_type: ShapeType
    x: float
    y: float
    radius: Optional[float] = None
    rotation: float = 0
    width: Optional[float] = None
    height: Optional[float] = None
    points: Optional[Any] = None
    color: str
    stroke_width: Optional[float] = None
    raw_data: Optional[Any] = None


class MapShapeUpdate(BaseModel):
    map_floor_id: Optional[uuid.UUID] = None
    shape_type: Optional[ShapeType] = None
    x: Optional[float] = None
    y: Optional[float] = None
    radius: Optional[float] = None
    rotation: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    points: Optional[Any] = None
    color: Optional[str] = None
    stroke_width: Optional[float] = None
    raw_data: Optional[Any] = None
