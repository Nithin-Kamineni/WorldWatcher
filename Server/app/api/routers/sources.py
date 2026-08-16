import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import Source
from app.schemas.common import Page, PageMeta
from app.schemas.reference import SourceCreate, SourceRead, SourceUpdate

router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("", response_model=Page[SourceRead])
async def list_sources(
    page: PaginationDep,
    q: Optional[str] = None,
    source_type: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Source)
    if source_type:
        base = base.where(Source.source_type == source_type)
    base = apply_search(base, Source, ["name", "abbreviation"], q)
    sorted_stmt = apply_sort(base, Source, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{source_id}", response_model=SourceRead)
async def get_source(source_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Source, source_id)


@router.post("", response_model=SourceRead, status_code=201)
async def create_source(payload: SourceCreate, db: AsyncSession = Depends(get_db)):
    obj = Source(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{source_id}", response_model=SourceRead)
async def update_source(source_id: uuid.UUID, payload: SourceUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Source, source_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{source_id}", status_code=204)
async def delete_source(source_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Source, source_id)
    await db.delete(obj)
    await db.commit()
