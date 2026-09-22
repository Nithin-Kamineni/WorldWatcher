"""entity_revisions: undoable edit history for World Manager content

Revision ID: d2a9f6c4e8b1
Revises: b6c1e4d8a725
Create Date: 2026-09-22 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains the source
of truth for indexes/constraints and is updated alongside this migration.

Backs the World Manager's "Recently edited" view, which now lists changes rather than
entities: one row per create/update/delete/restore of an article, NPC, homebrew creature
or faction, carrying both a display-level diff (`changes`) and a full snapshot of the
entity as it stood before the change (`before_state`) so the change can be undone.

`entity_id` is intentionally not a foreign key. It points at one of three tables depending
on `entity_type`, and more importantly the row has to OUTLIVE its entity - a delete whose
history row cascaded away with it would be the one change you can never undo. Same
looseness, for the same kind of reason, as item_usage.item_id.

No updated_at column and so no set_updated_at trigger: a revision is an immutable record
of something that already happened. Retention (6 hours or 500 rows per world, whichever is
larger) is enforced in app/services/revisions.py, not by a constraint.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd2a9f6c4e8b1'
down_revision: Union[str, Sequence[str], None] = 'b6c1e4d8a725'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "entity_revisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "world_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("worlds.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entity_type", sa.Text(), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_name", sa.Text(), nullable=False, server_default=""),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("changes", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("before_state", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    # The timeline query is exactly this index: one world, newest first.
    op.create_index(
        "entity_revisions_world_created_idx",
        "entity_revisions",
        ["world_id", sa.text("created_at DESC")],
    )
    # And the per-entity history a detail page asks for.
    op.create_index("entity_revisions_entity_idx", "entity_revisions", ["entity_type", "entity_id"])


def downgrade() -> None:
    op.drop_index("entity_revisions_entity_idx", table_name="entity_revisions")
    op.drop_index("entity_revisions_world_created_idx", table_name="entity_revisions")
    op.drop_table("entity_revisions")
