import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class SessionChatRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    note_id: Optional[uuid.UUID] = None
    name: str
    messages: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class SessionChatCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    campaign_id: uuid.UUID
    note_id: Optional[uuid.UUID] = None
    name: str
    messages: Optional[Any] = None


class SessionChatUpdate(BaseModel):
    note_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    messages: Optional[Any] = None
