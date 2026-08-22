"""NPC randomizer reference banks (random_names/professions/motivations/pitfalls)

Revision ID: e2b6f4a0d8c7
Revises: d7f3a8e1c9b4
Create Date: 2026-08-16 01:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Global reference data (no campaign_id), mirroring the `conditions` table's shape -
these are DM-tool-wide banks the NPC creation randomizer (Bugs.txt) picks from
client-side, not per-campaign data like random_encounter_tables. Names are seeded
from 5etools' names.json (first/last only, other structure discarded); professions/
motivations/pitfalls are hand-authored seed lists - see
Database/Maintainance/scripts/import_5etools_names.py, run once after this migration.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e2b6f4a0d8c7'
down_revision: Union[str, Sequence[str], None] = 'd7f3a8e1c9b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "random_names",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("name_type", sa.Text(), nullable=False),
        sa.Column("raw_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("name_type IN ('first','last')", name="random_names_name_type_check"),
        sa.UniqueConstraint("name", "name_type", name="random_names_name_type_uidx"),
    )
    op.create_index("random_names_name_type_idx", "random_names", ["name_type"])

    op.create_table(
        "random_professions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text(), nullable=False, unique=True),
        sa.Column("raw_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "random_motivations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "random_pitfalls",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("random_pitfalls")
    op.drop_table("random_motivations")
    op.drop_table("random_professions")
    op.drop_index("random_names_name_type_idx", table_name="random_names")
    op.drop_table("random_names")
