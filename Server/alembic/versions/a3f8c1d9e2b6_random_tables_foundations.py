"""random tables foundations: category tree, tag vocabulary, table formats, core engine

Revision ID: a3f8c1d9e2b6
Revises: f2b7d4e9c6a1
Create Date: 2026-09-01 00:00:00.000001

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Full Random Tables + Encounters subsystem overhaul (Tasks 1-5 of the build
prompt): a self-referential `category` tree, a normalized `tag` vocabulary
(namespace:value), a `table_formats` lookup the roll engine dispatches on,
and the core `random_tables`/`table_columns`/`table_entries` engine that
replaces the old `random_encounter_tables`/`situational_tables`/
`encounter_tables` designs (those tables are migrated into this one and
dropped in a later migration once the data-migration script has run).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a3f8c1d9e2b6'
down_revision: Union[str, Sequence[str], None] = 'f2b7d4e9c6a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "category",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.Text(), nullable=False, unique=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("category.id", ondelete="CASCADE")),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("icon", sa.Text()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("category_parent_id_idx", "category", ["parent_id"])

    op.create_table(
        "tag",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("namespace", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.UniqueConstraint("namespace", "value", name="tag_namespace_value_uidx"),
    )
    op.create_index("tag_namespace_idx", "tag", ["namespace"])

    op.create_table(
        "table_formats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.Text(), nullable=False, unique=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("tier", sa.Text(), nullable=False, server_default="core"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.CheckConstraint("tier IN ('core','advanced')", name="table_formats_tier_check"),
    )

    op.create_table(
        "random_tables",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("category.id")),
        sa.Column("format_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("table_formats.id"), nullable=False),
        sa.Column("trigger_situation", sa.Text()),
        sa.Column("image_url", sa.Text()),
        sa.Column("combine_template", sa.Text()),
        sa.Column("source_book", sa.Text()),
        sa.Column("format_config", postgresql.JSONB()),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("random_tables_campaign_id_idx", "random_tables", ["campaign_id"])
    op.create_index("random_tables_category_id_idx", "random_tables", ["category_id"])
    op.create_index("random_tables_format_id_idx", "random_tables", ["format_id"])
    op.create_index("random_tables_name_trgm_idx", "random_tables", ["name"], postgresql_using="gin", postgresql_ops={"name": "gin_trgm_ops"})
    op.execute(
        "CREATE TRIGGER trg_random_tables_updated_at BEFORE UPDATE ON random_tables "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )

    op.create_table(
        "random_table_tag",
        sa.Column("table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("random_tables.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("random_table_tag_tag_id_idx", "random_table_tag", ["tag_id"])

    op.create_table(
        "encounter_tag",
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("encounters.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("encounter_tag_tag_id_idx", "encounter_tag", ["tag_id"])

    op.create_table(
        "table_columns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("random_tables.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("die_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("die_sides", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("die_modifier", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("table_columns_table_id_idx", "table_columns", ["table_id"])

    op.create_table(
        "table_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("column_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("table_columns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("min", sa.Integer()),
        sa.Column("max", sa.Integer()),
        sa.Column("secondary_min", sa.Integer()),
        sa.Column("secondary_max", sa.Integer()),
        sa.Column("weight", sa.Integer()),
        sa.Column("kind", sa.Text(), nullable=False, server_default="text"),
        sa.Column("text", sa.Text()),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("encounters.id")),
        sa.Column("target_table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("random_tables.id")),
        sa.Column("creature_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("creatures.id")),
        sa.Column("npc_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("creatures.id")),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("items.id")),
        sa.Column("bundle", postgresql.JSONB()),
        sa.Column("notes", sa.Text()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint(
            "kind IN ('text','encounter_ref','table_ref','creature_ref','npc_ref','item_ref')",
            name="table_entries_kind_check",
        ),
    )
    op.create_index("table_entries_column_id_idx", "table_entries", ["column_id"])
    op.create_index("table_entries_encounter_id_idx", "table_entries", ["encounter_id"])
    op.create_index("table_entries_target_table_id_idx", "table_entries", ["target_table_id"])


def downgrade() -> None:
    op.drop_table("table_entries")
    op.drop_table("table_columns")
    op.drop_table("encounter_tag")
    op.drop_table("random_table_tag")
    op.drop_index("random_tables_name_trgm_idx", table_name="random_tables")
    op.drop_table("random_tables")
    op.drop_table("table_formats")
    op.drop_table("tag")
    op.drop_table("category")
