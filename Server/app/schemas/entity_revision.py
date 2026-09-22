import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class RevisionChange(BaseModel):
    """One field that moved. `kind` tells the client which layout to use, and the extra
    fields are the ones only that layout needs - a character delta for prose, item counts
    for a list - so they are optional rather than zero-filled."""

    field: str
    label: str
    kind: str
    before: str = ""
    after: str = ""
    delta: Optional[int] = None
    before_count: Optional[int] = None
    after_count: Optional[int] = None


class EntityRevisionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    world_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    entity_name: str
    action: str
    summary: str
    changes: list[RevisionChange]
    created_at: datetime
    # Whether this row has an earlier version behind it. The full `before_state` is
    # deliberately NOT sent: it is a whole entity per row, it would multiply the timeline
    # payload by the size of the content, and the client never needs it - Restore runs
    # server-side and hands back the restored entity.
    can_restore: bool


class RestoreResult(BaseModel):
    """What the client needs to refresh itself after a restore: which entity moved, and
    whether it had to be brought back from the dead (in which case lists that had dropped
    it need a refetch rather than a patch)."""

    entity_type: str
    entity_id: uuid.UUID
    entity_name: str
    recreated: bool
    revision: Optional[EntityRevisionRead] = None


class RetentionPolicy(BaseModel):
    """So the UI can state the retention rule without hardcoding a copy of it that drifts
    the day the constants in services/revisions.py change."""

    window_hours: int
    min_rows: int


def to_read(row: Any) -> EntityRevisionRead:
    """`can_restore` is derived, not stored - it is exactly "something came before this"."""
    return EntityRevisionRead(
        id=row.id,
        world_id=row.world_id,
        entity_type=row.entity_type,
        entity_id=row.entity_id,
        entity_name=row.entity_name,
        action=row.action,
        summary=row.summary,
        changes=[RevisionChange(**c) for c in (row.changes or [])],
        created_at=row.created_at,
        can_restore=bool(row.before_state),
    )
