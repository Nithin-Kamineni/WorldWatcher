"""notes: campaign-scoped Sessions/Narratives folder system

Revision ID: c9f3a1e7d5b2
Revises: e8a2f5c1d9b3
Create Date: 2026-08-30 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Adds note_folders and notes - the campaign-scoped sibling of article_folders/
articles (see a1c9e5f2b7d4), backing the new Notes rail section's Folders
toggle. Two note_folders rows per campaign (Sessions/Narratives) are seeded
lazily by the frontend's useNoteStore.ensureSeeded on first visit, not by this
migration - is_default/default_kind mark those two as protected from
rename/delete (enforced server-side too, see api/routers/notes.py).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c9f3a1e7d5b2'
down_revision: Union[str, Sequence[str], None] = 'e8a2f5c1d9b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "note_folders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("note_folders.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("default_kind", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("note_folders_campaign_id_idx", "note_folders", ["campaign_id"])
    op.create_index("note_folders_parent_id_idx", "note_folders", ["parent_id"])
    op.execute(
        "CREATE TRIGGER trg_note_folders_updated_at BEFORE UPDATE ON note_folders "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )

    op.create_table(
        "notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("folder_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("note_folders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("notes_campaign_id_idx", "notes", ["campaign_id"])
    op.create_index("notes_folder_id_idx", "notes", ["folder_id"])
    op.execute(
        "CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON notes "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )


def downgrade() -> None:
    op.drop_index("notes_folder_id_idx", table_name="notes")
    op.drop_index("notes_campaign_id_idx", table_name="notes")
    op.drop_table("notes")

    op.drop_index("note_folders_parent_id_idx", table_name="note_folders")
    op.drop_index("note_folders_campaign_id_idx", table_name="note_folders")
    op.drop_table("note_folders")
