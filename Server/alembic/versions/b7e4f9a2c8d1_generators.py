"""generators: composite/prompt-driven table generators

Revision ID: b7e4f9a2c8d1
Revises: a3f8c1d9e2b6
Create Date: 2026-09-01 00:00:00.000002

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Task 6 of the Random Tables build prompt: `generators` composes several
`random_tables` into named output slots (fixed or tag-filtered by an input
parameter), combined via a template string.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b7e4f9a2c8d1'
down_revision: Union[str, Sequence[str], None] = 'a3f8c1d9e2b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "generators",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id")),
        sa.Column("slug", sa.Text(), nullable=False, unique=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("category.id")),
        sa.Column("description", sa.Text()),
        sa.Column("combine_template", sa.Text(), nullable=False),
        sa.Column("parameters", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("generators_campaign_id_idx", "generators", ["campaign_id"])
    op.create_index("generators_category_id_idx", "generators", ["category_id"])
    op.execute(
        "CREATE TRIGGER trg_generators_updated_at BEFORE UPDATE ON generators "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )

    op.create_table(
        "generator_components",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("generator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("generators.id", ondelete="CASCADE"), nullable=False),
        sa.Column("table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("random_tables.id"), nullable=False),
        sa.Column("output_slot", sa.Text(), nullable=False),
        sa.Column("filter_param_key", sa.Text()),
        sa.Column("roll_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("optional", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("generator_id", "output_slot", name="generator_components_slot_uidx"),
    )
    op.create_index("generator_components_generator_id_idx", "generator_components", ["generator_id"])

    op.create_table(
        "generator_tag",
        sa.Column("generator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("generators.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("generator_tag")
    op.drop_table("generator_components")
    op.drop_table("generators")
