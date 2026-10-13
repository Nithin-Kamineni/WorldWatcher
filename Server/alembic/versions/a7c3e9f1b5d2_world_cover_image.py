"""worlds.cover_image_asset_id: a wide cover photo for the World Home page

Revision ID: a7c3e9f1b5d2
Revises: d2a9f6c4e8b1
Create Date: 2026-09-25 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth and is updated alongside this migration.

`image_asset_id` is the world's small logo (the top-bar switcher shows it); a
home-page banner wants a wide landscape image, which is a different picture, so
it gets its own column - same shape as articles.cover_image_asset_id.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a7c3e9f1b5d2'
down_revision: Union[str, Sequence[str], None] = 'd2a9f6c4e8b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'worlds',
        sa.Column('cover_image_asset_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('assets.id'), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('worlds', 'cover_image_asset_id')
