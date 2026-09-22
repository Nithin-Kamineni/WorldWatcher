import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ItemUsageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    kind: str
    item_id: str
    rolls: int
    opens: int
    last_used_at: datetime


class ItemUsageRecord(BaseModel):
    """One observation. The client posts what HAPPENED, not the new totals - two Play windows
    (or two devices) recording the same open would otherwise race and one would clobber the
    other's count. The server increments."""

    campaign_id: uuid.UUID
    kind: str
    item_id: str
    # 'use' is the strong signal (rolled/ran/read open), 'open' the weak one.
    event: Literal["use", "open"] = "open"
    # How many events to fold in at once - lets the client flush a batch it collected while
    # offline rather than posting one request per click.
    count: int = Field(default=1, ge=1, le=1000)
