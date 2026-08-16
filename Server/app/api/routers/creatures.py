import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import (
    PaginationDep,
    apply_campaign_scope,
    apply_in_list,
    apply_search,
    apply_sort,
    create_kwargs,
    get_or_404,
    paginate,
)
from app.core.database import get_db
from app.models import Creature, CreatureAction
from app.schemas.common import Page, PageMeta
from app.schemas.creatures import (
    CreatureActionCreate,
    CreatureActionRead,
    CreatureActionUpdate,
    CreatureCreate,
    CreatureDetail,
    CreatureRead,
    CreatureUpdate,
)

router = APIRouter(prefix="/creatures", tags=["creatures"])


@router.get("", response_model=Page[CreatureRead])
async def list_creatures(
    page: PaginationDep,
    q: Optional[str] = None,
    category: Optional[str] = None,
    creature_type: Optional[str] = None,
    alignment: Optional[str] = None,
    size: Optional[str] = None,
    source_id: Optional[uuid.UUID] = None,
    campaign_id: Optional[uuid.UUID] = None,
    scope: str = "own",
    cr_min: Optional[float] = None,
    cr_max: Optional[float] = None,
    ac_min: Optional[int] = None,
    ac_max: Optional[int] = None,
    relation: Optional[str] = None,
    importance: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Creature)
    if category:
        base = base.where(Creature.category == category)
    base = apply_in_list(base, Creature, "creature_type", creature_type)
    base = apply_in_list(base, Creature, "alignment", alignment)
    if size:
        base = base.where(Creature.size == size)
    if source_id:
        base = base.where(Creature.source_id == source_id)
    base = apply_campaign_scope(base, Creature, campaign_id, scope)
    if cr_min is not None:
        base = base.where(Creature.challenge_rating >= cr_min)
    if cr_max is not None:
        base = base.where(Creature.challenge_rating <= cr_max)
    if ac_min is not None:
        base = base.where(Creature.armor_class >= ac_min)
    if ac_max is not None:
        base = base.where(Creature.armor_class <= ac_max)
    base = apply_in_list(base, Creature, "relation", relation)
    base = apply_in_list(base, Creature, "importance", importance)
    if is_favorite is not None:
        base = base.where(Creature.is_favorite == is_favorite)
    base = apply_search(base, Creature, ["name", "traits"], q)
    sorted_stmt = apply_sort(base, Creature, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{creature_id}", response_model=CreatureDetail)
async def get_creature(creature_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Creature, creature_id)
    actions = (
        await db.execute(
            select(CreatureAction)
            .where(CreatureAction.creature_id == creature_id)
            .order_by(CreatureAction.sort_order)
        )
    ).scalars().all()
    detail = CreatureDetail.model_validate(obj)
    detail.actions = [CreatureActionRead.model_validate(a) for a in actions]
    return detail


@router.post("", response_model=CreatureRead, status_code=201)
async def create_creature(payload: CreatureCreate, db: AsyncSession = Depends(get_db)):
    obj = Creature(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{creature_id}", response_model=CreatureRead)
async def update_creature(creature_id: uuid.UUID, payload: CreatureUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Creature, creature_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{creature_id}", status_code=204)
async def delete_creature(creature_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Creature, creature_id)
    await db.delete(obj)
    await db.commit()


# ---- Nested: creature actions ----


@router.get("/{creature_id}/actions", response_model=list[CreatureActionRead])
async def list_creature_actions(creature_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Creature, creature_id)
    actions = (
        await db.execute(
            select(CreatureAction)
            .where(CreatureAction.creature_id == creature_id)
            .order_by(CreatureAction.sort_order)
        )
    ).scalars().all()
    return actions


@router.post("/{creature_id}/actions", response_model=CreatureActionRead, status_code=201)
async def create_creature_action(
    creature_id: uuid.UUID, payload: CreatureActionCreate, db: AsyncSession = Depends(get_db)
):
    await get_or_404(db, Creature, creature_id)
    obj = CreatureAction(creature_id=creature_id, **payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/actions/{action_id}", response_model=CreatureActionRead)
async def update_creature_action(
    action_id: uuid.UUID, payload: CreatureActionUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await get_or_404(db, CreatureAction, action_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/actions/{action_id}", status_code=204)
async def delete_creature_action(action_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, CreatureAction, action_id)
    await db.delete(obj)
    await db.commit()
