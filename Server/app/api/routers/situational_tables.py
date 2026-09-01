"""Curated, hand-authored roleplay/exploration random tables (Encounters -> "Roleplay &
Exploration" tab) - small, static, global reference data seeded once via
Database/Maintainance/scripts/seed_situational_tables.py. No CRUD here on purpose, same
convention as random_bank.py: the app UI only reads these to render/roll from client-side,
it never edits the tables themselves."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import SituationalTable
from app.schemas.situational_table import SituationalTableRead

router = APIRouter(prefix="/situational-tables", tags=["situational-tables"])


@router.get("", response_model=list[SituationalTableRead])
async def list_situational_tables(
    theme: Optional[str] = None,
    tag: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SituationalTable))
    tables = list(result.scalars().all())
    # Filtered in Python rather than in SQL: this table only ever holds a few dozen
    # hand-authored rows, so there's no precedent elsewhere in this codebase for JSONB
    # array-containment filtering worth matching, and it keeps this endpoint trivial.
    if theme:
        tables = [t for t in tables if t.theme == theme]
    if tag:
        tables = [t for t in tables if tag in (t.tags or [])]
    return tables


@router.get("/{table_id}", response_model=SituationalTableRead)
async def get_situational_table(table_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SituationalTable).where(SituationalTable.id == table_id))
    table = result.scalar_one_or_none()
    if table is None:
        raise HTTPException(status_code=404, detail="Situational table not found")
    return table
