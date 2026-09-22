import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class NoteFolder(Base):
    """User-defined folder for organizing Notes within a Campaign - campaign-scoped sibling
    of ArticleFolder (see app/models/article.py), one level of nesting via self-referential
    parent_id. Two rows per campaign (Sessions/Narratives) are seeded as protected defaults
    (is_default=True) by the frontend's useNoteStore.ensureSeeded - see default_kind."""

    __tablename__ = "note_folders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("note_folders.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    # Protects the two seeded root folders (Sessions/Narratives) from rename/delete - see
    # api/routers/notes.py's guard on PATCH/DELETE /note-folders/{id}.
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    # 'session' | 'narrative' - which quick-create button's default root folder this is,
    # null for any other (non-default) folder.
    default_kind: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Note(Base):
    """Freeform or templated campaign note - session-prep sheets, narrative/arc-planning
    entries, or blank user notes, all one generic table (kind distinguishes the templated
    ones, mirroring Article's category column) organized via NoteFolder."""

    __tablename__ = "notes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    folder_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("note_folders.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    # 'session_prep' | 'narrative' | null (freeform user note)
    kind: Mapped[Optional[str]] = mapped_column(Text)
    # Which editor this file opens in: 'text' (the HTML body below), 'whiteboard' or 'tree'
    # (the canvas JSONB below). Orthogonal to `kind`, which says what a TEXT note is FOR -
    # a session-prep sheet is a text document with a template, a whiteboard is a different
    # kind of file altogether. Defaults to 'text' so every pre-existing row is unchanged.
    doc_type: Mapped[str] = mapped_column(Text, nullable=False, server_default="text")
    body: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    # The whole document for a whiteboard/tree note: sticky items + connections, or nodes +
    # links, plus the remembered pan/zoom. One JSONB blob rather than item/edge tables
    # because a canvas is only ever read and written whole, by one editor, and its shape is
    # still moving - the client normalizes it on read (Client/src/types/noteCanvas.ts).
    # '{}' rather than NULL for the same reason tags is '[]': one empty shape, not two.
    canvas: Mapped[Any] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    tags: Mapped[Any] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
