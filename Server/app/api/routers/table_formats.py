"""Random-table format registry, including user-authored formats.

Unknown custom slugs intentionally use the roll engine's lookup fallback;
this makes custom presentation/registry formats useful without arbitrary
server-side code execution.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import TableFormat
from app.schemas.random_tables import TableFormatCreate, TableFormatRead, TableFormatUpdate

router = APIRouter(prefix="/table-formats", tags=["table-formats"])


@router.get("", response_model=list[TableFormatRead])
async def list_table_formats(tier: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    stmt = select(TableFormat)
    if tier:
        stmt = stmt.where(TableFormat.tier == tier)
    stmt = stmt.order_by(TableFormat.tier, TableFormat.name)
    return (await db.execute(stmt)).scalars().all()


@router.post("", response_model=TableFormatRead, status_code=201)
async def create_table_format(payload: TableFormatCreate, db: AsyncSession = Depends(get_db)):
    slug = payload.slug.strip().lower().replace(" ", "_")
    if not slug or not payload.name.strip():
        raise HTTPException(status_code=422, detail="Format name and slug are required")
    if (await db.execute(select(TableFormat.id).where(TableFormat.slug == slug))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A format with that slug already exists")
    obj = TableFormat(slug=slug, name=payload.name.strip(), description=payload.description, tier=payload.tier, is_system=False)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{format_id}", response_model=TableFormatRead)
async def update_table_format(format_id: str, payload: TableFormatUpdate, db: AsyncSession = Depends(get_db)):
    import uuid
    obj = await db.get(TableFormat, uuid.UUID(format_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Format not found")
    if obj.is_system:
        raise HTTPException(status_code=403, detail="System formats are protected")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{format_id}", status_code=204)
async def delete_table_format(format_id: str, db: AsyncSession = Depends(get_db)):
    import uuid
    obj = await db.get(TableFormat, uuid.UUID(format_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Format not found")
    if obj.is_system:
        raise HTTPException(status_code=403, detail="System formats are protected")
    await db.delete(obj)
    await db.commit()
