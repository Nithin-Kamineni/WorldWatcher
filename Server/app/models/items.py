import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class Item(Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("sources.id"))
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    edition: Mapped[Optional[str]] = mapped_column(Text)
    item_type: Mapped[Optional[str]] = mapped_column(Text)
    rarity: Mapped[str] = mapped_column(Text, nullable=False)
    requires_attunement: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    attunement_requirement: Mapped[Optional[str]] = mapped_column(Text)
    weight: Mapped[Optional[float]] = mapped_column(Numeric(asdecimal=False))
    cost: Mapped[Optional[Any]] = mapped_column(JSONB)
    description: Mapped[Optional[str]] = mapped_column(Text)
    properties: Mapped[Optional[Any]] = mapped_column(JSONB)
    effects: Mapped[Optional[Any]] = mapped_column(JSONB)
    charges: Mapped[Optional[Any]] = mapped_column(JSONB)
    image_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
