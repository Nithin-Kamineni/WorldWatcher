"""Task 3: the normalized, namespaced tag vocabulary. Users may add tags
(preferably under an existing namespace); is_system distinguishes curated
vocabulary from user additions."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Tag
from app.schemas.random_tables import TagCreate, TagRead

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagRead])
async def list_tags(
    namespace: Optional[str] = None,
    q: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Tag)
    if namespace:
        stmt = stmt.where(Tag.namespace == namespace)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Tag.value.ilike(pattern), Tag.label.ilike(pattern)))
    stmt = stmt.order_by(Tag.namespace, Tag.value)
    return (await db.execute(stmt)).scalars().all()


@router.get("/namespaces", response_model=list[str])
async def list_tag_namespaces(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Tag.namespace).distinct().order_by(Tag.namespace))).scalars().all()
    return rows


@router.post("", response_model=TagRead, status_code=201)
async def create_tag(payload: TagCreate, db: AsyncSession = Depends(get_db)):
    existing = (
        await db.execute(select(Tag).where(Tag.namespace == payload.namespace, Tag.value == payload.value))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Tag '{payload.namespace}:{payload.value}' already exists")
    obj = Tag(namespace=payload.namespace, value=payload.value, label=payload.label, is_system=False)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj
