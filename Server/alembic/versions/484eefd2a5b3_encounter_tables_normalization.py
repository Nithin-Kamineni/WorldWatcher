"""encounter random-tables normalization: encounter_tables + encounter_table_creatures

Revision ID: 484eefd2a5b3
Revises: 60961abad1bf
Create Date: 2026-08-15 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Replaces reading encounters.tables/raw_data JSONB for display purposes: each
random-table row (min/max roll range) becomes its own encounter_tables row,
and each creature reference within that row becomes its own
encounter_table_creatures row with a real FK to creatures.id (resolved by
Database/EncounterProcessing's processing script), instead of a free-text
name buried in JSON with no relational link. encounters.tables/raw_data are
left in place (not dropped) as the original-source record.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '484eefd2a5b3'
down_revision: Union[str, Sequence[str], None] = '60961abad1bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "encounter_tables",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dice_expression", sa.Text(), nullable=True),
        sa.Column("min_level", sa.Integer(), nullable=True),
        sa.Column("max_level", sa.Integer(), nullable=True),
        sa.Column("min", sa.Integer(), nullable=False),
        sa.Column("max", sa.Integer(), nullable=False),
        sa.Column("result_text", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("encounter_tables_encounter_id_idx", "encounter_tables", ["encounter_id"])

    op.create_table(
        "encounter_table_creatures",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("encounter_table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("encounter_tables.id", ondelete="CASCADE"), nullable=False),
        sa.Column("creature_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("creatures.id"), nullable=True),
        sa.Column("creature_name_raw", sa.Text(), nullable=False),
        sa.Column("quantity_formula", sa.Text(), nullable=False, server_default="1"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("encounter_table_creatures_encounter_table_id_idx", "encounter_table_creatures", ["encounter_table_id"])
    op.create_index("encounter_table_creatures_creature_id_idx", "encounter_table_creatures", ["creature_id"])


def downgrade() -> None:
    op.drop_index("encounter_table_creatures_creature_id_idx", table_name="encounter_table_creatures")
    op.drop_index("encounter_table_creatures_encounter_table_id_idx", table_name="encounter_table_creatures")
    op.drop_table("encounter_table_creatures")

    op.drop_index("encounter_tables_encounter_id_idx", table_name="encounter_tables")
    op.drop_table("encounter_tables")
