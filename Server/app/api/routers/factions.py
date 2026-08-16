import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import Faction, FactionRelation
from app.schemas.campaign import (
    FactionCreate,
    FactionRead,
    FactionRelationCreate,
    FactionRelationRead,
    FactionRelationUpdate,
    FactionUpdate,
)
from app.schemas.common import Page, PageMeta

router = APIRouter(prefix="/factions", tags=["factions"])


@router.get("/relations", response_model=list[FactionRelationRead])
async def list_faction_relations(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FactionRelation).where(FactionRelation.campaign_id == campaign_id))
    return result.scalars().all()


@router.post("/relations", response_model=FactionRelationRead, status_code=201)
async def create_faction_relation(payload: FactionRelationCreate, db: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    a, b = data["faction_a_id"], data["faction_b_id"]
    if a == b:
        raise HTTPException(status_code=400, detail="A faction cannot have a relation with itself")
    data["faction_a_id"], data["faction_b_id"] = (a, b) if str(a) < str(b) else (b, a)
    obj = FactionRelation(**data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/relations/{relation_id}", response_model=FactionRelationRead)
async def update_faction_relation(relation_id: uuid.UUID, payload: FactionRelationUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, FactionRelation, relation_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/relations/{relation_id}", status_code=204)
async def delete_faction_relation(relation_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, FactionRelation, relation_id)
    await db.delete(obj)
    await db.commit()


@router.get("", response_model=Page[FactionRead])
async def list_factions(
    page: PaginationDep,
    q: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Faction)
    if campaign_id:
        base = base.where(Faction.campaign_id == campaign_id)
    base = apply_search(base, Faction, ["name"], q)
    sorted_stmt = apply_sort(base, Faction, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{faction_id}", response_model=FactionRead)
async def get_faction(faction_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Faction, faction_id)


@router.post("", response_model=FactionRead, status_code=201)
async def create_faction(payload: FactionCreate, db: AsyncSession = Depends(get_db)):
    obj = Faction(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{faction_id}", response_model=FactionRead)
async def update_faction(faction_id: uuid.UUID, payload: FactionUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Faction, faction_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{faction_id}", status_code=204)
async def delete_faction(faction_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Faction, faction_id)
    await db.delete(obj)
    await db.commit()
