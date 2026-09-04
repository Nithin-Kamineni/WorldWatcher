import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class Category(Base):
    """Self-referential browse tree for random tables/generators/encounters
    (Task 2). is_system marks curated seed nodes (not user-deletable);
    users may add child nodes under any node, system or not."""

    __tablename__ = "category"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("category.id", ondelete="CASCADE"))
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    icon: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Tag(Base):
    """Normalized, namespaced tag vocabulary (Task 3). Stored/queried as
    "namespace:value" (e.g. "env:forest"). is_system distinguishes curated
    vocabulary from user-added tags."""

    __tablename__ = "tag"
    __table_args__ = (UniqueConstraint("namespace", "value", name="tag_namespace_value_uidx"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    namespace: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class RandomTableTag(Base):
    __tablename__ = "random_table_tag"

    table_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("random_tables.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True)


class EncounterTag(Base):
    __tablename__ = "encounter_tag"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True)


class TableEntryTag(Base):
    """Per-entry tags (distinct from random_table_tag, which tags the whole
    table) - needed so a generator's constrained slots (Task 6.2.2/6.3.1)
    can filter individual entries by tag intersection with an input
    parameter, e.g. only "occupation" entries tagged env:forest."""

    __tablename__ = "table_entry_tag"

    entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("table_entries.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True)


class GeneratorTag(Base):
    __tablename__ = "generator_tag"

    generator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("generators.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True)


class TableFormat(Base):
    """Roll-mechanics lookup (Task 4) - lookup/weighted_pool/reference/
    scene_generator/cascading/generator (core) plus 10 advanced formats.
    FK'd from random_table so users can register new formats later, though
    the roll engine only knows how to dispatch the seeded slugs today."""

    __tablename__ = "table_formats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    tier: Mapped[str] = mapped_column(Text, nullable=False, default="core")
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class RandomTable(Base):
    """A rollable random table (Task 1/5). category/tags/format are the
    three orthogonal dimensions - category_id is the ONE topic node, tags
    are the many cross-cutting facets (joined via random_table_tag),
    format_id is the ONE roll mechanic. campaign_id NULL = shared/global
    library table (curated or user-authored-for-everyone); set = campaign
    homebrew, following the same own/own_or_global/all scope convention
    used by creatures/spells/items."""

    __tablename__ = "random_tables"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("category.id"))
    format_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("table_formats.id"), nullable=False)
    trigger_situation: Mapped[Optional[str]] = mapped_column(Text)
    image_url: Mapped[Optional[str]] = mapped_column(Text)
    combine_template: Mapped[Optional[str]] = mapped_column(Text)
    source_book: Mapped[Optional[str]] = mapped_column(Text)
    # Format-specific parameters that don't warrant their own columns (chance_percent
    # for chance_gate, doom_max/doom_per_draw for clock/countdown_deck, sequence_length
    # for sequence, grid axis labels, branch rules, etc) - see roll_engine.py FORMAT_CONFIG
    # docs per-format for the shape expected here.
    format_config: Mapped[Optional[Any]] = mapped_column(JSONB)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TableColumn(Base):
    """One rollable column of a table (Task 5.1.2). A single-column lookup
    table has exactly one; scene_generator/bundle/grid tables have several."""

    __tablename__ = "table_columns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    table_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("random_tables.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    die_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    die_sides: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    die_modifier: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class TableEntry(Base):
    """One row/result of a column (Task 5.1.3). kind selects which single
    target field is populated - text/encounter_ref/table_ref/creature_ref/
    npc_ref/item_ref. min/max are the roll range (lookup/grid/check_table/
    clock); weight drives weighted_pool/deck odds; sort_order drives
    ordered formats (sequence/deck draw order). secondary_min/max is the
    second axis for grid (d66-style) tables. bundle holds a JSON map of
    named sub-fields for the bundle/record format."""

    __tablename__ = "table_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    column_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("table_columns.id", ondelete="CASCADE"), nullable=False)
    min: Mapped[Optional[int]] = mapped_column(Integer)
    max: Mapped[Optional[int]] = mapped_column(Integer)
    secondary_min: Mapped[Optional[int]] = mapped_column(Integer)
    secondary_max: Mapped[Optional[int]] = mapped_column(Integer)
    weight: Mapped[Optional[int]] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(Text, nullable=False, default="text")
    text: Mapped[Optional[str]] = mapped_column(Text)
    encounter_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("encounters.id"))
    target_table_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("random_tables.id"))
    creature_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("creatures.id"))
    npc_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("creatures.id"))
    item_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id"))
    bundle: Mapped[Optional[Any]] = mapped_column(JSONB)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Generator(Base):
    """Composite/prompt-driven generator (Task 6) - combines several
    component tables into named slots, some fixed, some tag-filtered by
    an input parameter."""

    __tablename__ = "generators"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("category.id"))
    description: Mapped[Optional[str]] = mapped_column(Text)
    combine_template: Mapped[str] = mapped_column(Text, nullable=False)
    parameters: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GeneratorComponent(Base):
    __tablename__ = "generator_components"
    __table_args__ = (UniqueConstraint("generator_id", "output_slot", name="generator_components_slot_uidx"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    generator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("generators.id", ondelete="CASCADE"), nullable=False)
    table_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("random_tables.id"), nullable=False)
    output_slot: Mapped[str] = mapped_column(Text, nullable=False)
    filter_param_key: Mapped[Optional[str]] = mapped_column(Text)
    roll_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    optional: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
