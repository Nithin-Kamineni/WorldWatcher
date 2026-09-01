import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class SituationalTableRead(BaseModel):
    """Read-only - there's no Create/Update schema because there's no write endpoint for
    this reference content in v1 (it's seeded directly, see
    Database/Maintainance/scripts/seed_situational_tables.py)."""

    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    theme: str
    tags: list[str]
    description: str
    source: str
    # Array of { key, label, dieSize, entries: [{ roll, text }] } - kept as Any (matching
    # every other JSONB catch-all in this codebase, e.g. EncounterRead.tables) since this
    # is hand-authored display data rather than something else queries relationally.
    columns: Any
    created_at: datetime
    updated_at: datetime
