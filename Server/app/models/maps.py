import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class Map(Base):
    __tablename__ = "maps"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    location_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    map_kinds: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    map_location_text: Mapped[Optional[str]] = mapped_column(Text)
    setting: Mapped[Optional[str]] = mapped_column(Text)
    activity: Mapped[Optional[str]] = mapped_column(Text)
    grid_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    grid_size: Mapped[int] = mapped_column(Integer, nullable=False, default=70)
    grid_color: Mapped[str] = mapped_column(Text, nullable=False, default="rgba(128,128,128,0.35)")
    grid_thickness: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    grid_type: Mapped[str] = mapped_column(Text, nullable=False, default="square")
    primary_floor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("map_floors.id"))
    settings: Mapped[Optional[Any]] = mapped_column(JSONB)
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MapFloor(Base):
    __tablename__ = "map_floors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    map_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("maps.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    background_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False
    )
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)
    flipped_horizontal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    flipped_vertical: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rotation: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_encounter_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id")
    )
    walls: Mapped[Optional[Any]] = mapped_column(JSONB)
    doors: Mapped[Optional[Any]] = mapped_column(JSONB)
    lighting: Mapped[Optional[Any]] = mapped_column(JSONB)
    terrain: Mapped[Optional[Any]] = mapped_column(JSONB)
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TokenLibrary(Base):
    __tablename__ = "token_library"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    image_asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_size: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False, default=1)
    current_size: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False, default=1)
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MapToken(Base):
    __tablename__ = "map_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    map_floor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("map_floors.id", ondelete="CASCADE"), nullable=False
    )
    token_definition_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("token_library.id")
    )
    creature_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("creatures.id"))
    character_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("characters.id"))
    encounter_creature_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounter_creatures.id")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    image_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    x: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False)
    y: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False)
    size: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False)
    outline_color: Mapped[str] = mapped_column(Text, nullable=False, default="#f5c542")
    current_hp: Mapped[Optional[int]] = mapped_column(Integer)
    max_hp: Mapped[Optional[int]] = mapped_column(Integer)
    concentrating: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    death_save_successes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    death_save_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    effects: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MapShape(Base):
    __tablename__ = "map_shapes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    map_floor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("map_floors.id", ondelete="CASCADE"), nullable=False
    )
    shape_type: Mapped[str] = mapped_column(Text, nullable=False)
    x: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False)
    y: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False)
    radius: Mapped[Optional[float]] = mapped_column(Numeric(asdecimal=False))
    rotation: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False, default=0)
    width: Mapped[Optional[float]] = mapped_column(Numeric(asdecimal=False))
    height: Mapped[Optional[float]] = mapped_column(Numeric(asdecimal=False))
    points: Mapped[Optional[Any]] = mapped_column(JSONB)
    color: Mapped[str] = mapped_column(Text, nullable=False)
    stroke_width: Mapped[Optional[float]] = mapped_column(Numeric(asdecimal=False))
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
