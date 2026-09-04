"""table_entry_tag: per-entry tags for generator constrained slots

Revision ID: d4b1a7e3c8f5
Revises: c1d8f3a6e9b4
Create Date: 2026-09-01 00:00:00.000004

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Task 6.2.2/6.3.1 needs to filter individual table_entries by tag (e.g. only
"occupation" entries tagged env:forest) for a generator's constrained slots -
random_table_tag alone (whole-table tagging) can't express that, so this adds
the entry-level join.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4b1a7e3c8f5'
down_revision: Union[str, Sequence[str], None] = 'c1d8f3a6e9b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "table_entry_tag",
        sa.Column("entry_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("table_entries.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("table_entry_tag_tag_id_idx", "table_entry_tag", ["tag_id"])


def downgrade() -> None:
    op.drop_table("table_entry_tag")
