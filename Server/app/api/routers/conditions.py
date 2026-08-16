import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import Condition
from app.schemas.common import Page, PageMeta
from app.schemas.reference import ConditionCreate, ConditionRead, ConditionUpdate

router = APIRouter(prefix="/conditions", tags=["conditions"])


@router.get("", response_model=Page[ConditionRead])
async def list_conditions(
    page: PaginationDep,
    q: Optional[str] = None,
    condition_type: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Condition)
    if condition_type:
        base = base.where(Condition.condition_type == condition_type)
    base = apply_search(base, Condition, ["name"], q)
    sorted_stmt = apply_sort(base, Condition, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{condition_id}", response_model=ConditionRead)
async def get_condition(condition_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Condition, condition_id)


@router.post("", response_model=ConditionRead, status_code=201)
async def create_condition(payload: ConditionCreate, db: AsyncSession = Depends(get_db)):
    obj = Condition(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{condition_id}", response_model=ConditionRead)
async def update_condition(condition_id: uuid.UUID, payload: ConditionUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Condition, condition_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{condition_id}", status_code=204)
async def delete_condition(condition_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Condition, condition_id)
    await db.delete(obj)
    await db.commit()
