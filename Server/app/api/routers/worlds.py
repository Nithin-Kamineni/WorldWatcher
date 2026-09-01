import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import World
from app.schemas.common import Page, PageMeta
from app.schemas.world import WorldCreate, WorldRead, WorldUpdate

router = APIRouter(prefix="/worlds", tags=["worlds"])


@router.get("", response_model=Page[WorldRead])
async def list_worlds(
    page: PaginationDep,
    q: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(World)
    base = apply_search(base, World, ["name"], q)
    sorted_stmt = apply_sort(base, World, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{world_id}", response_model=WorldRead)
async def get_world(world_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, World, world_id)


@router.post("", response_model=WorldRead, status_code=201)
async def create_world(payload: WorldCreate, db: AsyncSession = Depends(get_db)):
    obj = World(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{world_id}", response_model=WorldRead)
async def update_world(world_id: uuid.UUID, payload: WorldUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, World, world_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{world_id}", status_code=204)
async def delete_world(world_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, World, world_id)
    await db.delete(obj)
    await db.commit()
