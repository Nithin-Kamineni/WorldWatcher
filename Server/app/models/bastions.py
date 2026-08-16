import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class BastionFacility(Base):
    """Reference catalog (importer-owned, like Spell/Item) - the D&D 2024 Bastion
    system's facility list, e.g. "Garden", "Armory"."""

    __tablename__ = "bastion_facilities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("sources.id"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    facility_type: Mapped[str] = mapped_column(Text, nullable=False, default="basic")
    space: Mapped[Optional[Any]] = mapped_column(JSONB)
    prerequisite_level: Mapped[Optional[int]] = mapped_column(Integer)
    hirelings: Mapped[Optional[Any]] = mapped_column(JSONB)
    orders: Mapped[Optional[Any]] = mapped_column(JSONB)
    description: Mapped[Optional[str]] = mapped_column(Text)
    image_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    page: Mapped[Optional[int]] = mapped_column(Integer)
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Bastion(Base):
    """Per-campaign tracker: one row per PC's stronghold."""

    __tablename__ = "bastions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    character_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("characters.id"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    treasury: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BastionFacilityInstance(Base):
    """Join: one row per facility a PC's bastion has actually built."""

    __tablename__ = "bastion_facility_instances"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    bastion_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bastions.id"), nullable=False)
    facility_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bastion_facilities.id"))
    custom_name: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="built")
    defenders_assigned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pending_order: Mapped[Optional[Any]] = mapped_column(JSONB)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
