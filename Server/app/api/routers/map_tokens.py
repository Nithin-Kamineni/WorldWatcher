import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import create_kwargs, get_or_404
from app.core.database import get_db
from app.models import MapFloor, MapShape, MapToken
from app.schemas.maps import (
    MapShapeCreate,
    MapShapeRead,
    MapShapeUpdate,
    MapTokenCreate,
    MapTokenRead,
    MapTokenUpdate,
)
from app.ws.manager import manager

floor_tokens_router = APIRouter(prefix="/map-floors", tags=["map-tokens"])
tokens_router = APIRouter(prefix="/map-tokens", tags=["map-tokens"])
floor_shapes_router = APIRouter(prefix="/map-floors", tags=["map-shapes"])
shapes_router = APIRouter(prefix="/map-shapes", tags=["map-shapes"])


def _floor_room(floor_id) -> str:
    return f"floor-{floor_id}"


# ---- Tokens ----


@floor_tokens_router.get("/{floor_id}/tokens", response_model=list[MapTokenRead])
async def list_map_tokens(floor_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, MapFloor, floor_id)
    tokens = (await db.execute(select(MapToken).where(MapToken.map_floor_id == floor_id))).scalars().all()
    return tokens


@floor_tokens_router.post("/{floor_id}/tokens", response_model=MapTokenRead, status_code=201)
async def create_map_token(floor_id: uuid.UUID, payload: MapTokenCreate, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, MapFloor, floor_id)
    data = create_kwargs(payload)
    data["map_floor_id"] = floor_id
    obj = MapToken(**data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    result = MapTokenRead.model_validate(obj)
    await manager.broadcast(_floor_room(floor_id), {"type": "token:created", "data": result.model_dump(mode="json")})
    return obj


@tokens_router.get("/{token_id}", response_model=MapTokenRead)
async def get_map_token(token_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, MapToken, token_id)


@tokens_router.patch("/{token_id}", response_model=MapTokenRead)
async def update_map_token(token_id: uuid.UUID, payload: MapTokenUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, MapToken, token_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    result = MapTokenRead.model_validate(obj)
    await manager.broadcast(
        _floor_room(obj.map_floor_id), {"type": "token:updated", "data": result.model_dump(mode="json")}
    )
    return obj


@tokens_router.delete("/{token_id}", status_code=204)
async def delete_map_token(token_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, MapToken, token_id)
    floor_id = obj.map_floor_id
    await db.delete(obj)
    await db.commit()
    await manager.broadcast(_floor_room(floor_id), {"type": "token:deleted", "data": {"id": str(token_id)}})


# ---- Shapes ----


@floor_shapes_router.get("/{floor_id}/shapes", response_model=list[MapShapeRead])
async def list_map_shapes(floor_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, MapFloor, floor_id)
    shapes = (await db.execute(select(MapShape).where(MapShape.map_floor_id == floor_id))).scalars().all()
    return shapes


@floor_shapes_router.post("/{floor_id}/shapes", response_model=MapShapeRead, status_code=201)
async def create_map_shape(floor_id: uuid.UUID, payload: MapShapeCreate, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, MapFloor, floor_id)
    data = create_kwargs(payload)
    data["map_floor_id"] = floor_id
    obj = MapShape(**data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    result = MapShapeRead.model_validate(obj)
    await manager.broadcast(_floor_room(floor_id), {"type": "shape:created", "data": result.model_dump(mode="json")})
    return obj


@shapes_router.get("/{shape_id}", response_model=MapShapeRead)
async def get_map_shape(shape_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, MapShape, shape_id)


@shapes_router.patch("/{shape_id}", response_model=MapShapeRead)
async def update_map_shape(shape_id: uuid.UUID, payload: MapShapeUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, MapShape, shape_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    result = MapShapeRead.model_validate(obj)
    await manager.broadcast(
        _floor_room(obj.map_floor_id), {"type": "shape:updated", "data": result.model_dump(mode="json")}
    )
    return obj


@shapes_router.delete("/{shape_id}", status_code=204)
async def delete_map_shape(shape_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, MapShape, shape_id)
    floor_id = obj.map_floor_id
    await db.delete(obj)
    await db.commit()
    await manager.broadcast(_floor_room(floor_id), {"type": "shape:deleted", "data": {"id": str(shape_id)}})
