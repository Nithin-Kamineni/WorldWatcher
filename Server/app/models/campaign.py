import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    image_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    ruleset: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    character_type: Mapped[str] = mapped_column(Text, nullable=False, default="pc")
    level: Mapped[Optional[int]] = mapped_column(Integer)
    class_: Mapped[Optional[str]] = mapped_column("class", Text)
    subclass: Mapped[Optional[str]] = mapped_column(Text)
    species: Mapped[Optional[str]] = mapped_column(Text)
    background: Mapped[Optional[str]] = mapped_column(Text)
    current_hp: Mapped[Optional[int]] = mapped_column(Integer)
    max_hp: Mapped[Optional[int]] = mapped_column(Integer)
    temporary_hp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    armor_class: Mapped[Optional[int]] = mapped_column(Integer)
    strength: Mapped[Optional[int]] = mapped_column(Integer)
    dexterity: Mapped[Optional[int]] = mapped_column(Integer)
    constitution: Mapped[Optional[int]] = mapped_column(Integer)
    intelligence: Mapped[Optional[int]] = mapped_column(Integer)
    wisdom: Mapped[Optional[int]] = mapped_column(Integer)
    charisma: Mapped[Optional[int]] = mapped_column(Integer)
    skills: Mapped[Optional[Any]] = mapped_column(JSONB)
    saving_throws: Mapped[Optional[Any]] = mapped_column(JSONB)
    resources: Mapped[Optional[Any]] = mapped_column(JSONB)
    equipment: Mapped[Optional[Any]] = mapped_column(JSONB)
    features: Mapped[Optional[Any]] = mapped_column(JSONB)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    portrait_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    token_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    parent_location_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    location_type: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    map_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("maps.id"))
    image_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Faction(Base):
    __tablename__ = "factions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    faction_type: Mapped[Optional[str]] = mapped_column(Text)
    goals: Mapped[Optional[Any]] = mapped_column(JSONB)
    beliefs: Mapped[Optional[Any]] = mapped_column(JSONB)
    resources: Mapped[Optional[Any]] = mapped_column(JSONB)
    locations: Mapped[Optional[Any]] = mapped_column(JSONB)
    members: Mapped[Optional[Any]] = mapped_column(JSONB)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    image_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    # Diplomacy graph fields (Bugs.txt: Faction table is now the single source of truth
    # for the Factions diplomacy graph - these back the graph's center-node card and the
    # comparison bars in FactionDetailPanel).
    governance: Mapped[Optional[str]] = mapped_column(Text)
    power: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    power_label: Mapped[Optional[str]] = mapped_column(Text)
    location_summary: Mapped[Optional[str]] = mapped_column(Text)
    military: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    naval: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    economy: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    reputation: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    influence: Mapped[str] = mapped_column(Text, nullable=False, default="regional")
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FactionRelation(Base):
    """One row per unordered faction pair (faction_a_id < faction_b_id, enforced by a
    CHECK constraint) - the same relation data is returned for "A's view of B" and "B's
    view of A" because there is only ever one row for the pair."""

    __tablename__ = "faction_relations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    faction_a_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("factions.id", ondelete="CASCADE"), nullable=False)
    faction_b_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("factions.id", ondelete="CASCADE"), nullable=False)
    relation_type: Mapped[str] = mapped_column(Text, nullable=False, default="neutral")
    strength: Mapped[int] = mapped_column(Integer, nullable=False, default=40)
    importance: Mapped[str] = mapped_column(Text, nullable=False, default="secondary")
    treaties: Mapped[Optional[Any]] = mapped_column(JSONB)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RandomEncounterTable(Base):
    """DM-built grouping of existing Encounters into a table the DM rolls a die against
    to pick one - distinct from Encounter.tables/resolution_type, which is importer-owned
    reference data for 5etools' own random-encounter tables."""

    __tablename__ = "random_encounter_tables"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    die_expression: Mapped[str] = mapped_column(Text, nullable=False, default="1d8")
    entries: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Quest(Base):
    __tablename__ = "quests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="not_started")
    quest_giver_character_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id")
    )
    quest_giver_creature_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creatures.id")
    )
    related_faction_ids: Mapped[Optional[Any]] = mapped_column(JSONB)
    related_location_ids: Mapped[Optional[Any]] = mapped_column(JSONB)
    objectives: Mapped[Optional[Any]] = mapped_column(JSONB)
    rewards: Mapped[Optional[Any]] = mapped_column(JSONB)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
