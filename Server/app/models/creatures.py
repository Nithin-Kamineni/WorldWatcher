"""Creatures (monsters + NPCs) and their structured actions."""
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class Creature(Base):
    __tablename__ = "creatures"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("sources.id"))
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    category: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    edition: Mapped[Optional[str]] = mapped_column(Text)
    creature_type: Mapped[Optional[str]] = mapped_column(Text)
    creature_subtype: Mapped[Optional[str]] = mapped_column(Text)
    size: Mapped[Optional[str]] = mapped_column(Text)
    alignment: Mapped[Optional[str]] = mapped_column(Text)
    challenge_rating: Mapped[Optional[float]] = mapped_column(Numeric(asdecimal=False))
    challenge_rating_display: Mapped[Optional[str]] = mapped_column(Text)
    proficiency_bonus: Mapped[Optional[int]] = mapped_column(Integer)
    armor_class: Mapped[Optional[int]] = mapped_column(Integer)
    hit_points: Mapped[Optional[int]] = mapped_column(Integer)
    hit_dice: Mapped[Optional[str]] = mapped_column(Text)
    strength: Mapped[Optional[int]] = mapped_column(Integer)
    dexterity: Mapped[Optional[int]] = mapped_column(Integer)
    constitution: Mapped[Optional[int]] = mapped_column(Integer)
    intelligence: Mapped[Optional[int]] = mapped_column(Integer)
    wisdom: Mapped[Optional[int]] = mapped_column(Integer)
    charisma: Mapped[Optional[int]] = mapped_column(Integer)
    skills: Mapped[Optional[str]] = mapped_column(Text)
    senses: Mapped[Optional[str]] = mapped_column(Text)
    passive_perception: Mapped[Optional[int]] = mapped_column(Integer)
    languages: Mapped[Optional[str]] = mapped_column(Text)
    traits: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)
    relation: Mapped[Optional[str]] = mapped_column(Text)
    importance: Mapped[Optional[str]] = mapped_column(Text)
    profession: Mapped[Optional[str]] = mapped_column(Text)
    level: Mapped[Optional[int]] = mapped_column(Integer)
    character_class: Mapped[Optional[str]] = mapped_column(Text)
    motivations: Mapped[Optional[str]] = mapped_column(Text)
    pitfalls: Mapped[Optional[str]] = mapped_column(Text)
    history: Mapped[Optional[str]] = mapped_column(Text)
    portrait_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    token_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    default_size: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False, default=1)
    current_size: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False, default=1)
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CreatureAction(Base):
    __tablename__ = "creature_actions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    creature_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creatures.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    action_type: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    description: Mapped[Optional[str]] = mapped_column(Text)
    attack_bonus: Mapped[Optional[int]] = mapped_column(Integer)
    reach: Mapped[Optional[int]] = mapped_column(Integer)
    range_normal: Mapped[Optional[int]] = mapped_column(Integer)
    range_long: Mapped[Optional[int]] = mapped_column(Integer)
    damage_formula: Mapped[Optional[str]] = mapped_column(Text)
    damage_type: Mapped[Optional[str]] = mapped_column(Text)
    save_ability: Mapped[Optional[str]] = mapped_column(Text)
    save_dc: Mapped[Optional[int]] = mapped_column(Integer)
    recharge: Mapped[Optional[str]] = mapped_column(Text)
    uses_text: Mapped[Optional[str]] = mapped_column(Text)
    area: Mapped[Optional[Any]] = mapped_column(JSONB)
    mechanics: Mapped[Optional[Any]] = mapped_column(JSONB)
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
