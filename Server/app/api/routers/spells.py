import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
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
from app.models import Spell
from app.schemas.common import Page, PageMeta
from app.schemas.spells import SpellCreate, SpellDetail, SpellRead, SpellUpdate

router = APIRouter(prefix="/spells", tags=["spells"])


@router.get("", response_model=Page[SpellRead])
async def list_spells(
    page: PaginationDep,
    q: Optional[str] = None,
    level: Optional[str] = None,
    school: Optional[str] = None,
    class_: Optional[str] = Query(default=None, alias="class"),
    source_id: Optional[uuid.UUID] = None,
    campaign_id: Optional[uuid.UUID] = None,
    scope: str = "own",
    concentration: Optional[bool] = None,
    ritual: Optional[bool] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Spell)
    if level:
        levels = [int(v) for v in level.split(",") if v != ""]
        if levels:
            base = base.where(Spell.level.in_(levels))
    base = apply_in_list(base, Spell, "school", school)
    if class_:
        classes = [c for c in class_.split(",") if c]
        if classes:
            base = base.where(or_(*[Spell.classes_display.ilike(f"%{c}%") for c in classes]))
    if source_id:
        base = base.where(Spell.source_id == source_id)
    base = apply_campaign_scope(base, Spell, campaign_id, scope)
    if concentration is not None:
        base = base.where(Spell.concentration == concentration)
    if ritual is not None:
        base = base.where(Spell.ritual == ritual)
    base = apply_search(base, Spell, ["name"], q)
    sorted_stmt = apply_sort(base, Spell, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{spell_id}", response_model=SpellDetail)
async def get_spell(spell_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Spell, spell_id)


@router.post("", response_model=SpellRead, status_code=201)
async def create_spell(payload: SpellCreate, db: AsyncSession = Depends(get_db)):
    obj = Spell(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{spell_id}", response_model=SpellRead)
async def update_spell(spell_id: uuid.UUID, payload: SpellUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Spell, spell_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{spell_id}", status_code=204)
async def delete_spell(spell_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Spell, spell_id)
    await db.delete(obj)
    await db.commit()
