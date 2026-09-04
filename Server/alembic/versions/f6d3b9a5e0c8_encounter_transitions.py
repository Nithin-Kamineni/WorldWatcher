"""real encounter transitions and wandering table links

Revision ID: f6d3b9a5e0c8
Revises: e5c2a8f4d9b7
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f6d3b9a5e0c8"
down_revision: Union[str, Sequence[str], None] = "e5c2a8f4d9b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("encounter_combat_blocks", "encounter_social_blocks", "encounter_exploration_blocks"):
        op.add_column(table, sa.Column("transition_encounter_id", postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(f"{table}_transition_fk", table, "encounters", ["transition_encounter_id"], ["id"], ondelete="SET NULL")
    op.add_column("encounter_exploration_blocks", sa.Column("wandering_table_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("encounter_exploration_wandering_table_fk", "encounter_exploration_blocks", "random_tables", ["wandering_table_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("encounter_exploration_wandering_table_fk", "encounter_exploration_blocks", type_="foreignkey")
    op.drop_column("encounter_exploration_blocks", "wandering_table_id")
    for table in ("encounter_exploration_blocks", "encounter_social_blocks", "encounter_combat_blocks"):
        op.drop_constraint(f"{table}_transition_fk", table, type_="foreignkey")
        op.drop_column(table, "transition_encounter_id")
