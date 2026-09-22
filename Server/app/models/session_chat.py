"""DM-only chat log for the Play page session runner - a running scratch log of quick
notes the DM types while running a live session, optionally tied to the session-prep
Note it's paired with (see app/models/note.py). Not player-facing chat and not a
persistent messaging system - just a per-campaign thread the DM can jot lines into while
running the table. messages is stored as JSONB (array of {id, text, createdAt}) rather
than a join table since it's structured but not relational - it only needs to render in
order and is replaced whole on write, matching the Note.tags / Quest.objectives
precedent for this kind of data in this codebase.
"""
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class SessionChat(Base):
    __tablename__ = "session_chats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    # Which session-prep Note this chat thread belongs to, if any.
    note_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("notes.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    # Array of { id, text, createdAt } - DM-only quick notes typed during a session, not
    # player-facing chat. Whole-array-replace on write, no per-item endpoints.
    messages: Mapped[Any] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
