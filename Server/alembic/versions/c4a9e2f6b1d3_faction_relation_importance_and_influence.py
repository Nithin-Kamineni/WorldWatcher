"""faction relation importance + faction influence

Revision ID: c4a9e2f6b1d3
Revises: b3e7c1a9f5d2
Create Date: 2026-08-16 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

- faction_relations.importance: 'primary'|'secondary' - drives the diplomacy
  graph's radial position (primary = inner ring, closer to center) and edge
  stroke width tier (primary = thick, secondary = thin), on top of the
  existing `strength` field which still varies weight within a tier.
- factions.influence: 'petty'|'local'|'minor'|'regional'|'major' - drives the
  diplomacy graph's node size; 'petty' factions are filtered out of the graph
  entirely and the DM can filter which other tiers are shown.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c4a9e2f6b1d3'
down_revision: Union[str, Sequence[str], None] = 'b3e7c1a9f5d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "faction_relations",
        sa.Column("importance", sa.Text(), nullable=False, server_default="secondary"),
    )
    op.create_check_constraint(
        "faction_relations_importance_check",
        "faction_relations",
        "importance IN ('primary','secondary')",
    )

    op.add_column(
        "factions",
        sa.Column("influence", sa.Text(), nullable=False, server_default="regional"),
    )
    op.create_check_constraint(
        "factions_influence_check",
        "factions",
        "influence IN ('petty','local','minor','regional','major')",
    )


def downgrade() -> None:
    op.drop_constraint("factions_influence_check", "factions", type_="check")
    op.drop_column("factions", "influence")

    op.drop_constraint("faction_relations_importance_check", "faction_relations", type_="check")
    op.drop_column("faction_relations", "importance")
