import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import Character
from app.schemas.campaign import CharacterCreate, CharacterRead, CharacterUpdate
from app.schemas.common import Page, PageMeta

router = APIRouter(prefix="/characters", tags=["characters"])


@router.get("", response_model=Page[CharacterRead])
async def list_characters(
    page: PaginationDep,
    q: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
    character_type: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Character)
    if campaign_id:
        base = base.where(Character.campaign_id == campaign_id)
    if character_type:
        base = base.where(Character.character_type == character_type)
    base = apply_search(base, Character, ["name"], q)
    sorted_stmt = apply_sort(base, Character, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{character_id}", response_model=CharacterRead)
async def get_character(character_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Character, character_id)


@router.post("", response_model=CharacterRead, status_code=201)
async def create_character(payload: CharacterCreate, db: AsyncSession = Depends(get_db)):
    obj = Character(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{character_id}", response_model=CharacterRead)
async def update_character(character_id: uuid.UUID, payload: CharacterUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Character, character_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{character_id}", status_code=204)
async def delete_character(character_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Character, character_id)
    await db.delete(obj)
    await db.commit()
