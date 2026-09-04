import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class Encounter(Base):
    __tablename__ = "encounters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    map_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("maps.id"))
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("sources.id"))
    page: Mapped[Optional[int]] = mapped_column(Integer)
    resolution_type: Mapped[str] = mapped_column(Text, nullable=False, default="fixed")
    tables: Mapped[Optional[Any]] = mapped_column(JSONB)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    challenge_rating_display: Mapped[Optional[str]] = mapped_column(Text)
    computed_adjusted_xp: Mapped[Optional[int]] = mapped_column(Integer)
    computed_cr: Mapped[Optional[str]] = mapped_column(Text)
    difficulty: Mapped[Optional[str]] = mapped_column(Text)
    theme: Mapped[Optional[str]] = mapped_column(Text)
    encounter_type: Mapped[Optional[str]] = mapped_column(Text)
    possible_locations: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    environment: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    starting_positions: Mapped[Optional[Any]] = mapped_column(JSONB)
    special_rules: Mapped[Optional[Any]] = mapped_column(JSONB)
    # DM-only prep notes (kept separate from read_aloud, the player-facing boxed text below).
    notes: Mapped[Optional[str]] = mapped_column(Text)
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    # --- shared "run layer" (Task 7.3) ---
    primary_type: Mapped[Optional[str]] = mapped_column(Text)  # combat | social | exploration
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("category.id"))
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft")  # draft | ready | used
    read_aloud: Mapped[Optional[str]] = mapped_column(Text)
    objective: Mapped[Optional[str]] = mapped_column(Text)
    party_level_min: Mapped[Optional[int]] = mapped_column(Integer)
    party_level_max: Mapped[Optional[int]] = mapped_column(Integer)
    party_size: Mapped[Optional[int]] = mapped_column(Integer)
    scaling_notes: Mapped[Optional[str]] = mapped_column(Text)
    location_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"))
    rewards: Mapped[Optional[Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EncounterCreature(Base):
    __tablename__ = "encounter_creatures"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False
    )
    creature_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("creatures.id"))
    custom_name: Mapped[Optional[str]] = mapped_column(Text)
    custom_image_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    size_override: Mapped[Optional[float]] = mapped_column(Numeric(asdecimal=False))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    role: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    raw_data: Mapped[Optional[Any]] = mapped_column(JSONB)


class EncounterCombatBlock(Base):
    """Optional 1:1 combat detail block (Task 8) - present when the
    encounter has a combat dimension, whether primary_type='combat' or a
    social/exploration encounter that can escalate into one."""

    __tablename__ = "encounter_combat_blocks"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id", ondelete="CASCADE"), primary_key=True
    )
    shape: Mapped[Optional[str]] = mapped_column(Text)
    victory_condition: Mapped[Optional[str]] = mapped_column(Text)
    awareness: Mapped[Optional[str]] = mapped_column(Text)
    start_range: Mapped[Optional[str]] = mapped_column(Text)
    lighting: Mapped[Optional[str]] = mapped_column(Text)
    terrain_type: Mapped[Optional[str]] = mapped_column(Text)
    terrain_features: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    morale: Mapped[Optional[str]] = mapped_column(Text)
    reinforcements: Mapped[Optional[Any]] = mapped_column(JSONB)
    dynamic_events: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    difficulty_band: Mapped[Optional[str]] = mapped_column(Text)
    computed_xp: Mapped[Optional[int]] = mapped_column(Integer)
    has_lair_or_legendary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    aftermath: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    scaling_notes: Mapped[Optional[str]] = mapped_column(Text)
    map_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("maps.id"))


class EncounterSocialBlock(Base):
    """Optional 1:1 social detail block (Task 9)."""

    __tablename__ = "encounter_social_blocks"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id", ondelete="CASCADE"), primary_key=True
    )
    shape: Mapped[Optional[str]] = mapped_column(Text)
    venue: Mapped[Optional[str]] = mapped_column(Text)
    tone: Mapped[Optional[str]] = mapped_column(Text)
    stakes: Mapped[Optional[str]] = mapped_column(Text)
    player_levers: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    key_checks: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    outcome_tiers: Mapped[Optional[Any]] = mapped_column(JSONB)
    social_clock: Mapped[Optional[Any]] = mapped_column(JSONB)
    gated_info: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    complications: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    escalation: Mapped[Optional[str]] = mapped_column(Text)
    transition_encounter_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("encounters.id"))


class EncounterNpc(Base):
    """Social roster row (Task 9.1) - joins to the existing `creatures`
    table where category='npc', same reference-not-duplicate pattern as
    EncounterCreature joining the combat roster to monster rows."""

    __tablename__ = "encounter_npcs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False
    )
    npc_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("creatures.id"), nullable=False)
    attitude: Mapped[Optional[str]] = mapped_column(Text)
    agenda: Mapped[Optional[str]] = mapped_column(Text)
    secret: Mapped[Optional[str]] = mapped_column(Text)
    leverage: Mapped[Optional[str]] = mapped_column(Text)
    rp_cues: Mapped[Optional[Any]] = mapped_column(JSONB)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class EncounterExplorationBlock(Base):
    """Optional 1:1 exploration detail block (Task 10)."""

    __tablename__ = "encounter_exploration_blocks"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id", ondelete="CASCADE"), primary_key=True
    )
    shape: Mapped[Optional[str]] = mapped_column(Text)
    environment: Mapped[Optional[str]] = mapped_column(Text)
    terrain_difficulty: Mapped[Optional[str]] = mapped_column(Text)
    obstacle_type: Mapped[Optional[str]] = mapped_column(Text)
    trap: Mapped[Optional[Any]] = mapped_column(JSONB)
    hazard: Mapped[Optional[Any]] = mapped_column(JSONB)
    skill_challenge: Mapped[Optional[Any]] = mapped_column(JSONB)
    puzzle: Mapped[Optional[Any]] = mapped_column(JSONB)
    sensory_clues: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    points_of_interest: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    navigation: Mapped[Optional[Any]] = mapped_column(JSONB)
    resource_cost: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    verticality: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    complications: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    transition_encounter_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("encounters.id"))
    wandering_table_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("random_tables.id"))


class EncounterTable(Base):
    """One row of a random-encounter roll table (resolution_type='random_table'),
    replacing the encounters.tables/raw_data JSONB blob as the source of truth for
    display: each {min, max} roll range gets its own relational row here, with its
    creatures normalized out into EncounterTableCreature (FK'd to creatures.id)
    instead of living as free-text names inside JSON. See
    Database/EncounterProcessing for the script that populates this from raw_data."""

    __tablename__ = "encounter_tables"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False
    )
    # e.g. "d20", "d100" - which die the DM rolls to land on this row. Nullable because
    # a table row can be authored by hand before a resolution die is picked.
    dice_expression: Mapped[Optional[str]] = mapped_column(Text)
    # Character-level band this row's table applies to, for source books (e.g. Xanathar's)
    # that give a different d100 table per level range under the same encounter/theme.
    min_level: Mapped[Optional[int]] = mapped_column(Integer)
    max_level: Mapped[Optional[int]] = mapped_column(Integer)
    min: Mapped[int] = mapped_column(Integer, nullable=False)
    max: Mapped[int] = mapped_column(Integer, nullable=False)
    # Tag-stripped narrative text for this row (e.g. "the pilots are Hostile") - kept so
    # rows with no creature reference at all (flavor-only results) still render something.
    result_text: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EncounterTableCreature(Base):
    """A creature reference within one EncounterTable row, e.g. "2d4 Pirates" or "1
    Pirate Captain" - creature_id is resolved by the processing script via a regex
    substring match against creatures.name, so the DM panel can join straight to the
    creature's stat block/token instead of re-parsing free text on every read."""

    __tablename__ = "encounter_table_creatures"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    encounter_table_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounter_tables.id", ondelete="CASCADE"), nullable=False
    )
    creature_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("creatures.id"))
    # The exact substring the regex pulled out of the {@creature ...} tag - kept even
    # when creature_id resolves, and is the only record of the reference when it
    # doesn't (no creatures row matched), so nothing is silently dropped.
    creature_name_raw: Mapped[str] = mapped_column(Text, nullable=False)
    # Fixed count ("1", "3") or a dice formula ("3d8", "1d4") - kept as text since it's
    # either depending on how the source book wrote that row.
    quantity_formula: Mapped[str] = mapped_column(Text, nullable=False, default="1")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
