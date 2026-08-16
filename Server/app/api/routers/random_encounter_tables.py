import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import RandomEncounterTable
from app.schemas.campaign import (
    RandomEncounterTableCreate,
    RandomEncounterTableRead,
    RandomEncounterTableUpdate,
)
from app.schemas.common import Page, PageMeta

router = APIRouter(prefix="/random-encounter-tables", tags=["random-encounter-tables"])


@router.get("", response_model=Page[RandomEncounterTableRead])
async def list_random_encounter_tables(
    page: PaginationDep,
    q: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(RandomEncounterTable)
    if campaign_id:
        base = base.where(RandomEncounterTable.campaign_id == campaign_id)
    base = apply_search(base, RandomEncounterTable, ["name"], q)
    sorted_stmt = apply_sort(base, RandomEncounterTable, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{table_id}", response_model=RandomEncounterTableRead)
async def get_random_encounter_table(table_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, RandomEncounterTable, table_id)


@router.post("", response_model=RandomEncounterTableRead, status_code=201)
async def create_random_encounter_table(payload: RandomEncounterTableCreate, db: AsyncSession = Depends(get_db)):
    obj = RandomEncounterTable(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{table_id}", response_model=RandomEncounterTableRead)
async def update_random_encounter_table(
    table_id: uuid.UUID, payload: RandomEncounterTableUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await get_or_404(db, RandomEncounterTable, table_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{table_id}", status_code=204)
async def delete_random_encounter_table(table_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, RandomEncounterTable, table_id)
    await db.delete(obj)
    await db.commit()
