"""add trigram GIN indexes for tag vocabulary search

Revision ID: e5c2a8f4d9b7
Revises: d4b1a7e3c8f5
"""
from typing import Sequence, Union

from alembic import op

revision: str = "e5c2a8f4d9b7"
down_revision: Union[str, Sequence[str], None] = "d4b1a7e3c8f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE INDEX IF NOT EXISTS tag_value_trgm_idx ON tag USING gin (value gin_trgm_ops)")
    op.execute("CREATE INDEX IF NOT EXISTS tag_label_trgm_idx ON tag USING gin (label gin_trgm_ops)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS tag_label_trgm_idx")
    op.execute("DROP INDEX IF EXISTS tag_value_trgm_idx")
