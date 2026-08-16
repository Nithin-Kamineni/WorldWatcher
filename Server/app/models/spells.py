import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class Spell(Base):
    __tablename__ = "spells"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("sources.id"))
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    edition: Mapped[Optional[str]] = mapped_column(Text)
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    school: Mapped[Optional[str]] = mapped_column(Text)
    casting_time: Mapped[Optional[str]] = mapped_column(Text)
    range: Mapped[Optional[str]] = mapped_column(Text)
    duration: Mapped[Optional[str]] = mapped_column(Text)
    concentration: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ritual: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    components_display: Mapped[Optional[str]] = mapped_column(Text)
    components: Mapped[Optional[Any]] = mapped_column(JSONB)
    classes_display: Mapped[Optional[str]] = mapped_column(Text)
    classes: Mapped[Optional[Any]] = mapped_column(JSONB)
    description: Mapped[Optional[str]] = mapped_column(Text)
    area: Mapped[Optional[Any]] = mapped_column(JSONB)
    damage: Mapped[Optional[Any]] = mapped_column(JSONB)
    saving_throw: Mapped[Optional[Any]] = mapped_column(JSONB)
    effects: Mapped[Optional[Any]] = mapped_column(JSONB)
    mechanics: Mapped[Optional[Any]] = mapped_column(JSONB)
    image_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
