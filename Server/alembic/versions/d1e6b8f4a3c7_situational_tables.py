"""situational_tables: curated roleplay/exploration random tables

Revision ID: d1e6b8f4a3c7
Revises: c9f3a1e7d5b2
Create Date: 2026-08-30 00:00:00.000001

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Adds situational_tables - curated, hand-authored non-combat roleplay/
exploration random tables for the Encounters section's new "Roleplay &
Exploration" tab (e.g. a themed "Darkwood Forest" table with linked encounter/
behavior/complication columns). Read-only reference content seeded by
Database/Maintainance/scripts/seed_situational_tables.py, same precedent as
the flat random_* bank tables - no write endpoints, no FK to anything.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd1e6b8f4a3c7'
down_revision: Union[str, Sequence[str], None] = 'c9f3a1e7d5b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "situational_tables",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("theme", sa.Text(), nullable=False),
        sa.Column("tags", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("source", sa.Text(), nullable=False, server_default=""),
        sa.Column("columns", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("situational_tables_theme_idx", "situational_tables", ["theme"])
    op.execute(
        "CREATE TRIGGER trg_situational_tables_updated_at BEFORE UPDATE ON situational_tables "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )


def downgrade() -> None:
    op.drop_index("situational_tables_theme_idx", table_name="situational_tables")
    op.drop_table("situational_tables")
