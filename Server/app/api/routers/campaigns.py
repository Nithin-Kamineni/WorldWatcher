import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import Campaign
from app.schemas.campaign import CampaignCreate, CampaignRead, CampaignUpdate
from app.schemas.common import Page, PageMeta

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=Page[CampaignRead])
async def list_campaigns(
    page: PaginationDep,
    q: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Campaign)
    base = apply_search(base, Campaign, ["name"], q)
    sorted_stmt = apply_sort(base, Campaign, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{campaign_id}", response_model=CampaignRead)
async def get_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Campaign, campaign_id)


@router.post("", response_model=CampaignRead, status_code=201)
async def create_campaign(payload: CampaignCreate, db: AsyncSession = Depends(get_db)):
    obj = Campaign(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{campaign_id}", response_model=CampaignRead)
async def update_campaign(campaign_id: uuid.UUID, payload: CampaignUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Campaign, campaign_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Campaign, campaign_id)
    await db.delete(obj)
    await db.commit()
