import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, create_kwargs, get_or_404, paginate
from app.core.database import get_db
from app.models import Map, MapFloor
from app.schemas.common import Page, PageMeta
from app.schemas.maps import MapCreate, MapFloorCreate, MapFloorRead, MapFloorUpdate, MapRead, MapUpdate

router = APIRouter(prefix="/maps", tags=["maps"])
floors_router = APIRouter(prefix="/map-floors", tags=["maps"])


@router.get("", response_model=Page[MapRead])
async def list_maps(
    page: PaginationDep,
    q: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
    location_id: Optional[uuid.UUID] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Map)
    if campaign_id:
        base = base.where(Map.campaign_id == campaign_id)
    if location_id:
        base = base.where(Map.location_id == location_id)
    base = apply_search(base, Map, ["name"], q)
    sorted_stmt = apply_sort(base, Map, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{map_id}", response_model=MapRead)
async def get_map(map_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Map, map_id)


@router.post("", response_model=MapRead, status_code=201)
async def create_map(payload: MapCreate, db: AsyncSession = Depends(get_db)):
    obj = Map(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{map_id}", response_model=MapRead)
async def update_map(map_id: uuid.UUID, payload: MapUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Map, map_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{map_id}", status_code=204)
async def delete_map(map_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Map, map_id)
    await db.delete(obj)
    await db.commit()


# ---- Nested: map floors ----


@router.get("/{map_id}/floors", response_model=list[MapFloorRead])
async def list_map_floors(map_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Map, map_id)
    floors = (
        await db.execute(select(MapFloor).where(MapFloor.map_id == map_id).order_by(MapFloor.sort_order))
    ).scalars().all()
    return floors


@router.post("/{map_id}/floors", response_model=MapFloorRead, status_code=201)
async def create_map_floor(map_id: uuid.UUID, payload: MapFloorCreate, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Map, map_id)
    data = create_kwargs(payload)
    data["map_id"] = map_id
    obj = MapFloor(**data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@floors_router.get("/{floor_id}", response_model=MapFloorRead)
async def get_map_floor(floor_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, MapFloor, floor_id)


@floors_router.patch("/{floor_id}", response_model=MapFloorRead)
async def update_map_floor(floor_id: uuid.UUID, payload: MapFloorUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, MapFloor, floor_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@floors_router.delete("/{floor_id}", status_code=204)
async def delete_map_floor(floor_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, MapFloor, floor_id)
    await db.delete(obj)
    await db.commit()
