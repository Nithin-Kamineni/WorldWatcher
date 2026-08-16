import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import Effect
from app.schemas.common import Page, PageMeta
from app.schemas.reference import EffectCreate, EffectRead, EffectUpdate

router = APIRouter(prefix="/effects", tags=["effects"])


@router.get("", response_model=Page[EffectRead])
async def list_effects(
    page: PaginationDep,
    q: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
    effect_type: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Effect)
    if campaign_id:
        base = base.where(Effect.campaign_id == campaign_id)
    if effect_type:
        base = base.where(Effect.effect_type == effect_type)
    base = apply_search(base, Effect, ["name"], q)
    sorted_stmt = apply_sort(base, Effect, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{effect_id}", response_model=EffectRead)
async def get_effect(effect_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Effect, effect_id)


@router.post("", response_model=EffectRead, status_code=201)
async def create_effect(payload: EffectCreate, db: AsyncSession = Depends(get_db)):
    obj = Effect(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{effect_id}", response_model=EffectRead)
async def update_effect(effect_id: uuid.UUID, payload: EffectUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Effect, effect_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{effect_id}", status_code=204)
async def delete_effect(effect_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Effect, effect_id)
    await db.delete(obj)
    await db.commit()
