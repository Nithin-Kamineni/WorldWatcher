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
from app.models import Item
from app.schemas.common import Page, PageMeta
from app.schemas.items import ItemCreate, ItemDetail, ItemRead, ItemUpdate

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=Page[ItemRead])
async def list_items(
    page: PaginationDep,
    q: Optional[str] = None,
    rarity: Optional[str] = None,
    item_type: Optional[str] = None,
    source_id: Optional[uuid.UUID] = None,
    campaign_id: Optional[uuid.UUID] = None,
    scope: str = "own",
    requires_attunement: Optional[bool] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Item)
    base = apply_in_list(base, Item, "rarity", rarity)
    if item_type:
        base = base.where(Item.item_type == item_type)
    if source_id:
        base = base.where(Item.source_id == source_id)
    base = apply_campaign_scope(base, Item, campaign_id, scope)
    if requires_attunement is not None:
        base = base.where(Item.requires_attunement == requires_attunement)
    base = apply_search(base, Item, ["name"], q)
    sorted_stmt = apply_sort(base, Item, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{item_id}", response_model=ItemDetail)
async def get_item(item_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Item, item_id)


@router.post("", response_model=ItemRead, status_code=201)
async def create_item(payload: ItemCreate, db: AsyncSession = Depends(get_db)):
    obj = Item(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{item_id}", response_model=ItemRead)
async def update_item(item_id: uuid.UUID, payload: ItemUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Item, item_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Item, item_id)
    await db.delete(obj)
    await db.commit()
