"""Edit history for world content, and the snapshots that make it undoable.

The World Manager's "Recently edited" view used to answer only *what* was touched, by
sorting entities on their `updated_at`. That is the one question a DM never asks: you
already know you edited the Silver Hand, you want to know what you did to it at 1am and
whether you can put it back. This table is the record of the change itself rather than
of the entity, so the view can show one row per edit, say which fields moved, and offer
to undo it.

WHY IT IS ONE TABLE AND NOT A `*_revisions` TABLE PER ENTITY. The view is cross-cutting -
it interleaves articles, NPCs and factions on one timeline - so a per-entity table would
be three queries and a merge sort for every render, and a fourth table the day a fifth
kind of world content becomes editable. `entity_id` is deliberately NOT a foreign key,
for the same reason `item_usage.item_id` isn't: the id points at one of several tables,
and (unlike a usage counter) the row has to *outlive* its entity, because the whole point
of recording a delete is to be able to undo it. A cascade would delete exactly the row
you need.

WHY `before_state` AND NOT A FIELD-LEVEL PATCH. Restore has to work when the entity is
gone entirely, which means the row must carry enough to recreate it, which means a full
column snapshot. Given that, storing a reverse patch as well would be storing the same
information twice; `changes` holds only what the UI displays (truncated previews), and
`before_state` is the authoritative thing Restore writes back.

RETENTION lives in services/revisions.py - see `prune_world_revisions`.
"""
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Index, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class EntityRevision(Base):
    __tablename__ = "entity_revisions"
    __table_args__ = (
        # The only query this table serves is "the newest N changes in this world", so the
        # index is the query: world first, then time descending.
        Index("entity_revisions_world_created_idx", "world_id", text("created_at DESC")),
        Index("entity_revisions_entity_idx", "entity_type", "entity_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    # Every tracked entity resolves to exactly one world - directly for articles, through
    # campaign_id for NPCs and factions. Campaign-less rows (the global compendium library)
    # are not world content and are never recorded; see services/revisions.py.
    world_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False
    )
    # article | npc | creature | faction. Text rather than an enum so tracking a fifth kind
    # of content is a one-line change in the service, not a migration.
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # Denormalised on purpose: after a delete there is nothing left to join to for a name,
    # and after a rename the history should still read as it did at the time.
    entity_name: Mapped[str] = mapped_column(Text, nullable=False, server_default="")

    # create | update | delete | restore. A restore is itself a recorded change (its own
    # before_state is the state it replaced), which is what makes undo undoable.
    action: Mapped[str] = mapped_column(Text, nullable=False)
    # The one-line "how it was edited" the timeline shows under each title.
    summary: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    # [{field, label, before, after}] - display data only, with long text truncated to a
    # preview. Never read by restore.
    changes: Mapped[Any] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    # Full column snapshot of the entity as it stood BEFORE this change. NULL on a create,
    # where there is nothing to go back to. This is what Restore writes back.
    before_state: Mapped[Optional[Any]] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
