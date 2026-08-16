import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class Combat(Base):
    __tablename__ = "combats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    encounter_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("encounters.id"))
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    map_floor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("map_floors.id"))
    name: Mapped[Optional[str]] = mapped_column(Text)
    round: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    current_turn: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="idle")
    events: Mapped[Optional[Any]] = mapped_column(JSONB)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Combatant(Base):
    __tablename__ = "combatants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    combat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("combats.id", ondelete="CASCADE"), nullable=False
    )
    map_token_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("map_tokens.id"))
    creature_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("creatures.id"))
    character_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("characters.id"))
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    current_hp: Mapped[Optional[int]] = mapped_column(Integer)
    temporary_hp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_hp: Mapped[Optional[int]] = mapped_column(Integer)
    initiative_base_roll: Mapped[Optional[int]] = mapped_column(Integer)
    initiative_modifier: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    initiative: Mapped[Optional[int]] = mapped_column(Integer)
    initiative_order: Mapped[Optional[int]] = mapped_column(Integer)
    initiative_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_current_turn: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    x: Mapped[Optional[float]] = mapped_column(Numeric(asdecimal=False))
    y: Mapped[Optional[float]] = mapped_column(Numeric(asdecimal=False))
    z: Mapped[Optional[float]] = mapped_column(Numeric(asdecimal=False))
    movement_used: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False, default=0)
    conditions: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    effects: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    resources: Mapped[Optional[Any]] = mapped_column(JSONB)
    concentration: Mapped[Optional[Any]] = mapped_column(JSONB)
    death_save_successes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    death_save_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    action_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    bonus_action_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reaction_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    visibility: Mapped[Optional[Any]] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
