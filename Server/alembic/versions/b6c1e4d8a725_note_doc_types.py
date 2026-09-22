"""notes: doc_type + canvas (whiteboard / content-tree files)

Revision ID: b6c1e4d8a725
Revises: a3d565c82927
Create Date: 2026-09-22 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

A Notes folder could only hold written pages. Two more file types join them -
a whiteboard (draggable sticky notes, labels, frames, arrows) and a content
tree (tech trees, family trees, hierarchies) - and both are the same kind of
thing to the database: a note whose content is a canvas document instead of an
HTML body.

  * `doc_type` says which editor opens the row ('text' | 'whiteboard' |
    'tree'), defaulting to 'text' so every existing note is untouched. It is
    deliberately NOT folded into the existing `kind` column: `kind` says what a
    text note is FOR (a session-prep sheet, a narrative entry, both of which
    are templated bodies), while `doc_type` says what the file IS. A whiteboard
    filed as session prep is a sensible thing to want, and collapsing the two
    columns would make it unrepresentable.
  * `canvas` holds the whole canvas document as one JSONB blob (items +
    connections, or nodes + links, plus the remembered pan/zoom). Not item and
    edge tables: a canvas is only ever read and written whole, by one editor,
    nothing joins to an individual sticky, and the shape is still moving. The
    client normalizes it on read (Client/src/types/noteCanvas.ts), which is
    what makes a document saved by an older build keep opening.

NOT NULL with a '{}' default, mirroring notes.tags's '[]' - "no canvas" has one
representation, not two.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b6c1e4d8a725'
down_revision: Union[str, Sequence[str], None] = 'a3d565c82927'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DOC_TYPES = "'text','whiteboard','tree'"


def upgrade() -> None:
    op.add_column("notes", sa.Column("doc_type", sa.Text(), nullable=False, server_default="text"))
    op.add_column(
        "notes",
        sa.Column("canvas", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.execute("ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_doc_type_check")
    op.execute(f"ALTER TABLE notes ADD CONSTRAINT notes_doc_type_check CHECK (doc_type IN ({DOC_TYPES}))")


def downgrade() -> None:
    op.execute("ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_doc_type_check")
    op.drop_column("notes", "canvas")
    op.drop_column("notes", "doc_type")
