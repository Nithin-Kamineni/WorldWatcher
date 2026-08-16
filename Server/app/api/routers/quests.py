import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import Quest
from app.schemas.campaign import QuestCreate, QuestRead, QuestUpdate
from app.schemas.common import Page, PageMeta

router = APIRouter(prefix="/quests", tags=["quests"])


@router.get("", response_model=Page[QuestRead])
async def list_quests(
    page: PaginationDep,
    q: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Quest)
    if campaign_id:
        base = base.where(Quest.campaign_id == campaign_id)
    if status:
        base = base.where(Quest.status == status)
    base = apply_search(base, Quest, ["name"], q)
    sorted_stmt = apply_sort(base, Quest, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{quest_id}", response_model=QuestRead)
async def get_quest(quest_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Quest, quest_id)


@router.post("", response_model=QuestRead, status_code=201)
async def create_quest(payload: QuestCreate, db: AsyncSession = Depends(get_db)):
    obj = Quest(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{quest_id}", response_model=QuestRead)
async def update_quest(quest_id: uuid.UUID, payload: QuestUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Quest, quest_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{quest_id}", status_code=204)
async def delete_quest(quest_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Quest, quest_id)
    await db.delete(obj)
    await db.commit()
