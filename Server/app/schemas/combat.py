import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

CombatStatus = Literal["idle", "rolling", "active", "completed"]
CombatantStatus = Literal["active", "down", "dead", "fled", "removed"]


class CombatantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    combat_id: uuid.UUID
    map_token_id: Optional[uuid.UUID] = None
    creature_id: Optional[uuid.UUID] = None
    character_id: Optional[uuid.UUID] = None
    display_name: str
    current_hp: Optional[int] = None
    temporary_hp: int
    max_hp: Optional[int] = None
    initiative_base_roll: Optional[int] = None
    initiative_modifier: int
    initiative: Optional[int] = None
    initiative_order: Optional[int] = None
    initiative_locked: bool
    is_current_turn: bool
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None
    movement_used: float
    conditions: Any = []
    effects: Any = []
    resources: Optional[Any] = None
    concentration: Optional[Any] = None
    death_save_successes: int
    death_save_failures: int
    action_used: bool
    bonus_action_used: bool
    reaction_used: bool
    visibility: Optional[Any] = None
    status: str
    created_at: datetime
    updated_at: datetime


class CombatantCreate(BaseModel):
    map_token_id: Optional[uuid.UUID] = None
    creature_id: Optional[uuid.UUID] = None
    character_id: Optional[uuid.UUID] = None
    display_name: str
    current_hp: Optional[int] = None
    temporary_hp: int = 0
    max_hp: Optional[int] = None
    initiative_base_roll: Optional[int] = None
    initiative_modifier: int = 0
    initiative: Optional[int] = None
    initiative_order: Optional[int] = None
    initiative_locked: bool = False
    is_current_turn: bool = False
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None
    movement_used: float = 0
    conditions: Any = []
    effects: Any = []
    resources: Optional[Any] = None
    concentration: Optional[Any] = None
    death_save_successes: int = 0
    death_save_failures: int = 0
    action_used: bool = False
    bonus_action_used: bool = False
    reaction_used: bool = False
    visibility: Optional[Any] = None
    status: CombatantStatus = "active"


class CombatantUpdate(BaseModel):
    map_token_id: Optional[uuid.UUID] = None
    creature_id: Optional[uuid.UUID] = None
    character_id: Optional[uuid.UUID] = None
    display_name: Optional[str] = None
    current_hp: Optional[int] = None
    temporary_hp: Optional[int] = None
    max_hp: Optional[int] = None
    initiative_base_roll: Optional[int] = None
    initiative_modifier: Optional[int] = None
    initiative: Optional[int] = None
    initiative_order: Optional[int] = None
    initiative_locked: Optional[bool] = None
    is_current_turn: Optional[bool] = None
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None
    movement_used: Optional[float] = None
    conditions: Optional[Any] = None
    effects: Optional[Any] = None
    resources: Optional[Any] = None
    concentration: Optional[Any] = None
    death_save_successes: Optional[int] = None
    death_save_failures: Optional[int] = None
    action_used: Optional[bool] = None
    bonus_action_used: Optional[bool] = None
    reaction_used: Optional[bool] = None
    visibility: Optional[Any] = None
    status: Optional[CombatantStatus] = None


class CombatRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    encounter_id: Optional[uuid.UUID] = None
    campaign_id: uuid.UUID
    map_floor_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    round: int
    current_turn: Optional[int] = None
    status: str
    events: Optional[Any] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class CombatDetail(CombatRead):
    combatants: list[CombatantRead] = []


class CombatCreate(BaseModel):
    encounter_id: Optional[uuid.UUID] = None
    campaign_id: uuid.UUID
    map_floor_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    round: int = 1
    current_turn: Optional[int] = None
    status: CombatStatus = "idle"
    events: Optional[Any] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class CombatUpdate(BaseModel):
    encounter_id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    map_floor_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    round: Optional[int] = None
    current_turn: Optional[int] = None
    status: Optional[CombatStatus] = None
    events: Optional[Any] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
