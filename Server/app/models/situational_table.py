"""Curated, hand-authored roleplay/exploration random tables (Encounters -> "Roleplay &
Exploration" tab) - e.g. a themed "Darkwood Forest" table with linked encounter/behavior/
complication columns the DM rolls (or picks) across to build a scene prompt. This is
read-mostly reference content, not user-editable in the UI: seeded once via
Database/Maintainance/scripts/seed_situational_tables.py, same precedent as the flat
random_* bank tables in reference.py. Columns are stored as JSONB rather than normalized
into join tables since this is hand-authored content that only needs to render, matching
how Quest.objectives/floor.raw_data already use JSONB catch-alls for "structured but not
relational" data in this codebase.
"""
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class SituationalTable(Base):
    __tablename__ = "situational_tables"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    # Single primary category (e.g. "Forest", "Tavern", "City Street", "Dungeon Corridor",
    # "Planar Rift", "Adventures", "Loot") - drives the theme filter chips in the UI.
    theme: Mapped[str] = mapped_column(Text, nullable=False)
    # Freeform filter tags, e.g. ["exploration", "roleplay", "forest", "wilderness"].
    tags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    # Attribution, e.g. "Darkwood Forest example" or "Dungeon Master's Guide (2024), p. 120".
    source: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    # Array of { key, label, dieSize, entries: [{ roll, text }] } - one object per sub-table
    # column, each independently rolled and combined into a single scene prompt. See the
    # seed script for the exact shape used by every row currently in this table.
    columns: Mapped[Any] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
