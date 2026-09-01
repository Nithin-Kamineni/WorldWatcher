"""NPC appearance/secrets/relationships + matching randomizer banks

Revision ID: b8d4f1a6c3e9
Revises: a1c9e5f2b7d4
Create Date: 2026-08-29 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Three new nullable NPC-only Text columns on `creatures`, newline-joined
itemized lists (same convention as the existing `motivations`/`pitfalls`/
`traits` columns - no JSONB needed). `traits` itself is reused as-is for the
NPC "Personality" field (already was, per its own code comment), so no column
for personality here.

Four new reference banks (`random_appearances`, `random_secrets`,
`random_personalities`, `random_relationships`), exact structural clones of
`random_motivations`/`random_pitfalls` - global reference data, seeded by
Database/Maintainance/scripts/seed_npc_roleplay_banks.py, run once after this
migration.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b8d4f1a6c3e9'
down_revision: Union[str, Sequence[str], None] = 'a1c9e5f2b7d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("creatures", sa.Column("appearance", sa.Text(), nullable=True))
    op.add_column("creatures", sa.Column("secrets", sa.Text(), nullable=True))
    op.add_column("creatures", sa.Column("relationships", sa.Text(), nullable=True))

    op.create_table(
        "random_appearances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "random_secrets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "random_personalities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "random_relationships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("random_relationships")
    op.drop_table("random_personalities")
    op.drop_table("random_secrets")
    op.drop_table("random_appearances")
    op.drop_column("creatures", "relationships")
    op.drop_column("creatures", "secrets")
    op.drop_column("creatures", "appearance")
