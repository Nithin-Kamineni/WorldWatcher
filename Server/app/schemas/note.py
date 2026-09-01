import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

NoteKind = Literal["session_prep", "narrative"]
NoteFolderDefaultKind = Literal["session", "narrative"]


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
    body: str
    tags: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class NoteCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    campaign_id: uuid.UUID
    folder_id: Optional[uuid.UUID] = None
    name: str
    kind: Optional[NoteKind] = None
    body: str = ""
    tags: Optional[Any] = None


class NoteUpdate(BaseModel):
    folder_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    kind: Optional[NoteKind] = None
    body: Optional[str] = None
    tags: Optional[Any] = None
