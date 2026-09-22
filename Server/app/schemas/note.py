import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

NoteKind = Literal["session_prep", "narrative"]
# Which editor a note opens in - see Note.doc_type. Orthogonal to NoteKind.
NoteDocType = Literal["text", "whiteboard", "tree"]
# "dm_notes" is the protected folder INSIDE the session folder that lists the DM's chat
# threads (issues.txt 10.b.3) rather than notes - see the client's NotesFolderExplorer.
NoteFolderDefaultKind = Literal["session", "narrative", "dm_notes"]


class NoteFolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    name: str
    is_default: bool
    default_kind: Optional[NoteFolderDefaultKind] = None
    created_at: datetime
    updated_at: datetime


class NoteFolderCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    campaign_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    name: str
    is_default: bool = False
    default_kind: Optional[NoteFolderDefaultKind] = None


class NoteFolderUpdate(BaseModel):
    parent_id: Optional[uuid.UUID] = None
    name: Optional[str] = None


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    folder_id: Optional[uuid.UUID] = None
    name: str
    kind: Optional[NoteKind] = None
    doc_type: NoteDocType = "text"
    body: str
    canvas: Optional[Any] = None
    tags: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class _CanvasNeverNull(BaseModel):
    """notes.canvas is NOT NULL (server_default '{}'), matching notes.tags - but the client
    sends the whole note back on every PATCH, and a text note's canvas is null on its side.
    Coerce it here rather than making the column nullable, so "no canvas" has exactly one
    representation in the database."""

    @field_validator("canvas", check_fields=False)
    @classmethod
    def _empty_canvas(cls, value: Optional[Any]) -> Any:
        return {} if value is None else value


class NoteCreate(_CanvasNeverNull):
    id: Optional[uuid.UUID] = None
    campaign_id: uuid.UUID
    folder_id: Optional[uuid.UUID] = None
    name: str
    kind: Optional[NoteKind] = None
    doc_type: NoteDocType = "text"
    body: str = ""
    # default_factory, not None: a validator does not run on a default, and the column is
    # NOT NULL - a create that omits canvas has to arrive as {}.
    canvas: Any = Field(default_factory=dict)
    tags: Optional[Any] = None


class NoteUpdate(_CanvasNeverNull):
    folder_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    kind: Optional[NoteKind] = None
    doc_type: Optional[NoteDocType] = None
    body: Optional[str] = None
    canvas: Optional[Any] = None
    tags: Optional[Any] = None
