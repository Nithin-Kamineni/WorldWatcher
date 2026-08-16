import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import Location
from app.schemas.campaign import LocationCreate, LocationRead, LocationUpdate
from app.schemas.common import Page, PageMeta

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("", response_model=Page[LocationRead])
async def list_locations(
    page: PaginationDep,
    q: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
    parent_location_id: Optional[uuid.UUID] = None,
    location_type: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Location)
    if campaign_id:
        base = base.where(Location.campaign_id == campaign_id)
    if parent_location_id:
        base = base.where(Location.parent_location_id == parent_location_id)
    if location_type:
        base = base.where(Location.location_type == location_type)
    base = apply_search(base, Location, ["name"], q)
    sorted_stmt = apply_sort(base, Location, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{location_id}", response_model=LocationRead)
async def get_location(location_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Location, location_id)


@router.post("", response_model=LocationRead, status_code=201)
async def create_location(payload: LocationCreate, db: AsyncSession = Depends(get_db)):
    obj = Location(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{location_id}", response_model=LocationRead)
async def update_location(location_id: uuid.UUID, payload: LocationUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Location, location_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{location_id}", status_code=204)
async def delete_location(location_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Location, location_id)
    await db.delete(obj)
    await db.commit()
