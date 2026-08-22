"""NPC base-creature link

Revision ID: d7f3a8e1c9b4
Revises: c4a9e2f6b1d3
Create Date: 2026-08-16 00:30:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Splitting NPCs into their own DM Panel tab (Bugs.txt) keeps NPCs and Monsters in
the single `creatures` table (category='monster'|'npc') rather than a separate
`npcs` table, to avoid duplicating the whole ability-score/AC/HP stat-block
schema and to make "pick a monster, autofill an NPC's stats from it" a simple
column copy instead of a cross-table join. Two new columns support that flow:
- base_creature_id: self-referential nullable FK - which monster (if any) an
  NPC's stats were last autofilled from. Only ever points at a
  category='monster' row; enforced at the application layer, not by a DB CHECK
  (this table has no precedent for cross-row category CHECKs).
- is_custom_build: whether the NPC form is in "custom" mode (manual class/
  level/etc, today's only NPC behavior) vs "creature" mode (picked from the
  monster catalog). Defaults true so existing NPC rows read as custom-built,
  which they are.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd7f3a8e1c9b4'
down_revision: Union[str, Sequence[str], None] = 'c4a9e2f6b1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "creatures",
        sa.Column("base_creature_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("creatures.id"), nullable=True),
    )
    op.add_column(
        "creatures",
        sa.Column("is_custom_build", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("creatures_base_creature_id_idx", "creatures", ["base_creature_id"])


def downgrade() -> None:
    op.drop_index("creatures_base_creature_id_idx", table_name="creatures")
    op.drop_column("creatures", "is_custom_build")
    op.drop_column("creatures", "base_creature_id")
