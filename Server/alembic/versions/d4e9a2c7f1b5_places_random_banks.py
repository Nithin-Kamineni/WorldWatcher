"""Places randomizer reference banks (dungeon/building/settlement flavor tables)

Revision ID: d4e9a2c7f1b5
Revises: b8d4f1a6c3e9
Create Date: 2026-08-29 12:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Ten global reference banks (no campaign_id) powering the World Manager's Places
tab (Countries/Settlements/Buildings/Dungeons): dungeon states-of-ruin, dungeon
quirks, shop types, tavern name parts, and six settlement flavor tables. Same flat
text-list shape as e2b6f4a0d8c7's random_motivations/random_pitfalls - no
uniqueness constraint, seeded once via
Database/Maintainance/scripts/seed_places_random_banks.py, run once after this
migration.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4e9a2c7f1b5'
down_revision: Union[str, Sequence[str], None] = 'b8d4f1a6c3e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_FLAT_TEXT_TABLES = [
    "random_dungeon_states_of_ruin",
    "random_dungeon_quirks",
    "random_shop_types",
    "random_settlement_defining_traits",
    "random_settlement_claims_to_fame",
    "random_settlement_calamities",
    "random_settlement_local_leaders",
    "random_settlement_economic_sources",
    "random_settlement_rumors_hooks",
]


def upgrade() -> None:
    for table_name in _FLAT_TEXT_TABLES:
        op.create_table(
            table_name,
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )

    op.create_table(
        "random_tavern_name_parts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("part_type", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("part_type IN ('first','second')", name="random_tavern_name_parts_part_type_check"),
    )
    op.create_index("random_tavern_name_parts_part_type_idx", "random_tavern_name_parts", ["part_type"])


def downgrade() -> None:
    op.drop_index("random_tavern_name_parts_part_type_idx", table_name="random_tavern_name_parts")
    op.drop_table("random_tavern_name_parts")
    for table_name in reversed(_FLAT_TEXT_TABLES):
        op.drop_table(table_name)
