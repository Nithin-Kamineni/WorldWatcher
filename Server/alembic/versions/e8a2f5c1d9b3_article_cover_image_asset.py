"""articles: cover_image_src -> cover_image_asset_id

Revision ID: e8a2f5c1d9b3
Revises: d4e9a2c7f1b5
Create Date: 2026-08-29 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Articles previously stored their cover image as a raw `cover_image_src` text
column (the frontend wrote `URL.createObjectURL(...)` blob strings into it,
which don't survive a reload - a bug, not a deliberate design). Every other
entity's image (Faction/Spell/MagicItem/Creature) goes through the `assets`
table via an `image_asset_id` FK instead; this migration brings Article in
line with that convention, following 9f1d6c3a7e42's pattern for extending the
assets.asset_type CHECK constraint.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e8a2f5c1d9b3'
down_revision: Union[str, Sequence[str], None] = 'd4e9a2c7f1b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_TYPES = (
    "'creature_portrait','creature_token','item_image','map','npc_portrait',"
    "'faction_image','location_image','spell_image','character_portrait',"
    "'character_token','bastion_facility_image','other'"
)
NEW_TYPES = (
    "'creature_portrait','creature_token','item_image','map','npc_portrait',"
    "'faction_image','location_image','spell_image','character_portrait',"
    "'character_token','bastion_facility_image','article_cover_image','other'"
)


def upgrade() -> None:
    op.execute("ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_check")
    op.execute(f"ALTER TABLE assets ADD CONSTRAINT assets_asset_type_check CHECK (asset_type IN ({NEW_TYPES}))")

    op.add_column(
        "articles",
        sa.Column("cover_image_asset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assets.id"), nullable=True),
    )
    op.drop_column("articles", "cover_image_src")


def downgrade() -> None:
    op.add_column("articles", sa.Column("cover_image_src", sa.Text(), nullable=False, server_default=""))
    op.drop_column("articles", "cover_image_asset_id")

    op.execute("ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_check")
    op.execute(f"ALTER TABLE assets ADD CONSTRAINT assets_asset_type_check CHECK (asset_type IN ({OLD_TYPES}))")
