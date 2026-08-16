"""assets.asset_type: add 'bastion_facility_image'

Revision ID: 9f1d6c3a7e42
Revises: 7c2a4f9e1b83
Create Date: 2026-08-15 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '9f1d6c3a7e42'
down_revision: Union[str, Sequence[str], None] = '7c2a4f9e1b83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_TYPES = (
    "'creature_portrait','creature_token','item_image','map','npc_portrait',"
    "'faction_image','location_image','spell_image','character_portrait',"
    "'character_token','other'"
)
NEW_TYPES = (
    "'creature_portrait','creature_token','item_image','map','npc_portrait',"
    "'faction_image','location_image','spell_image','character_portrait',"
    "'character_token','bastion_facility_image','other'"
)


def upgrade() -> None:
    op.execute("ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_check")
    op.execute(f"ALTER TABLE assets ADD CONSTRAINT assets_asset_type_check CHECK (asset_type IN ({NEW_TYPES}))")


def downgrade() -> None:
    op.execute("ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_check")
    op.execute(f"ALTER TABLE assets ADD CONSTRAINT assets_asset_type_check CHECK (asset_type IN ({OLD_TYPES}))")
