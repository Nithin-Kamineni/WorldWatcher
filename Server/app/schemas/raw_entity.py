import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class RawEntityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source: str
    source_file: str
    source_key: str
    entity_type: str
    raw_data: Any
    content_hash: str
    linked_table: Optional[str] = None
    linked_id: Optional[uuid.UUID] = None
    import_status: str
    imported_at: datetime
    updated_at: datetime
