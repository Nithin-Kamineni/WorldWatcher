import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.api.utils import PaginationDep, apply_search, apply_sort, create_kwargs, get_or_404, paginate
from app.core.config import settings
from app.core.database import get_db
from app.models import Asset, Map, MapFloor
from app.schemas.common import Page, PageMeta
from app.schemas.maps import (
    MapCreate,
    MapFloorCreate,
    MapFloorRead,
    MapFloorUpdate,
    MapRead,
    MapUpdate,
    WallDetectRequest,
    WallDetectResponse,
)
from app.services.wall_detect import WallDetectUnavailable, detect_walls
from app.ws.manager import manager

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
    result = MapFloorRead.model_validate(obj)
    # Broadcasts initiative/flip/rotation/locked-encounter changes - the piece of combat state
    # every "run the encounter" hotkey touches - to other clients watching this floor. Token
    # field edits (HP, tags, notes) already broadcast via map_tokens.py's update_map_token.
    await manager.broadcast(f"floor-{floor_id}", {"type": "floor:updated", "data": result.model_dump(mode="json")})
    return obj


@floors_router.post("/{floor_id}/detect-walls", response_model=WallDetectResponse)
async def detect_map_floor_walls(
    floor_id: uuid.UUID,
    payload: WallDetectRequest,
    db: AsyncSession = Depends(get_db),
):
    """Traces candidate sight-blocking walls out of the floor's background image.

    Read-only as far as the walls themselves go: the result is returned for the
    client to review and append, never written straight into map_floors.walls -
    auto-detection on a painted map always needs cleanup, and silently
    overwriting hand-drawn walls with its guesses would be hostile.
    """
    floor = await get_or_404(db, MapFloor, floor_id)
    asset = await get_or_404(db, Asset, floor.background_asset_id)

    # Same traversal guard the asset file route applies - storage_path comes
    # from the DB, but it still must not escape the assets root.
    root = os.path.abspath(settings.assets_dir)
    full_path = os.path.abspath(os.path.join(root, asset.storage_path))
    if os.path.commonpath([root, full_path]) != root:
        raise HTTPException(status_code=400, detail="Invalid storage path")
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Map image missing on disk")

    try:
        # OpenCV is CPU-bound and releases the GIL only in places; keep it off
        # the event loop so one detection cannot stall every other request.
        width, height, polylines = await run_in_threadpool(
            detect_walls, full_path, payload.mode, payload.sensitivity
        )
    except WallDetectUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # The width/height columns have existed since the schema was written and
    # have never been populated; this is the one code path that knows them.
    if floor.width != width or floor.height != height:
        floor.width = width
        floor.height = height
        await db.commit()

    return WallDetectResponse(image_width=width, image_height=height, polylines=polylines)


@floors_router.delete("/{floor_id}", status_code=204)
async def delete_map_floor(floor_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, MapFloor, floor_id)
    await db.delete(obj)
    await db.commit()
