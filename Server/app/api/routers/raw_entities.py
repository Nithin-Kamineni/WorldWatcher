"""Read-only access to the lossless import safety net. Useful for
debugging/inspecting fields that haven't been projected into a
relational column yet."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import RawEntity
from app.schemas.common import Page, PageMeta
from app.schemas.raw_entity import RawEntityRead

router = APIRouter(prefix="/raw-entities", tags=["raw-entities"])


@router.get("", response_model=Page[RawEntityRead])
async def list_raw_entities(
    page: PaginationDep,
    entity_type: Optional[str] = None,
    source: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(RawEntity)
    if entity_type:
        base = base.where(RawEntity.entity_type == entity_type)
    if source:
        base = base.where(RawEntity.source == source)
    sorted_stmt = apply_sort(base, RawEntity, sort, "imported_at", default_desc=True)
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{raw_entity_id}", response_model=RawEntityRead)
async def get_raw_entity(raw_entity_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, RawEntity, raw_entity_id)
