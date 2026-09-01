"""session_chats: DM-only chat log for the Play page session runner

Revision ID: f2b7d4e9c6a1
Revises: d1e6b8f4a3c7
Create Date: 2026-08-30 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Adds session_chats - a campaign-scoped, DM-only chat/scratch log for the
upcoming Play page session runner, optionally tied to the session-prep Note
it's paired with (see c9f3a1e7d5b2's notes/note_folders). messages is stored
as JSONB (array of {id, text, createdAt}), replaced whole on write, matching
the Note.tags / SituationalTable.columns precedent for structured-but-not-
relational data in this codebase.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f2b7d4e9c6a1'
down_revision: Union[str, Sequence[str], None] = 'd1e6b8f4a3c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "session_chats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("messages", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("session_chats_campaign_id_idx", "session_chats", ["campaign_id"])
    op.create_index("session_chats_note_id_idx", "session_chats", ["note_id"])
    op.execute(
        "CREATE TRIGGER trg_session_chats_updated_at BEFORE UPDATE ON session_chats "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )


def downgrade() -> None:
    op.drop_index("session_chats_note_id_idx", table_name="session_chats")
    op.drop_index("session_chats_campaign_id_idx", table_name="session_chats")
    op.drop_table("session_chats")
