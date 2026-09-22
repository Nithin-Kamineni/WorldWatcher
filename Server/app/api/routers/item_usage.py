import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.core.database import get_db
from app.models import ItemUsage
from app.schemas.item_usage import ItemUsageRead, ItemUsageRecord

router = APIRouter(prefix="/item-usage", tags=["item-usage"])


@router.get("", response_model=list[ItemUsageRead])
async def list_item_usage(
    campaign_id: uuid.UUID,
    kind: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Every usage row for a campaign - the client loads this once and ranks in memory.

    Deliberately not paginated: this is at most a few hundred rows per campaign (one per item
    the DM has ever opened) and the ranker needs all of them at once to sort anything, so a page
    boundary would just mean the client immediately asking for the rest."""
    stmt = select(ItemUsage).where(ItemUsage.campaign_id == campaign_id)
    if kind is not None:
        stmt = stmt.where(ItemUsage.kind == kind)
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=ItemUsageRead)
async def record_item_usage(payload: ItemUsageRecord, db: AsyncSession = Depends(get_db)):
    """Folds one observation into the running counters.

    An upsert with a server-side increment, not a read-modify-write: two Play windows recording
    an open of the same table at the same moment must both count, and the unique constraint on
    (campaign_id, kind, item_id) is what makes that safe to express in a single statement."""
    rolls = payload.count if payload.event == "use" else 0
    opens = payload.count if payload.event == "open" else 0

    stmt = (
        pg_insert(ItemUsage)
        .values(
            campaign_id=payload.campaign_id,
            kind=payload.kind,
            item_id=payload.item_id,
            rolls=rolls,
            opens=opens,
            last_used_at=func.now(),
        )
        .on_conflict_do_update(
            constraint="uq_item_usage_campaign_kind_item",
            set_={
                "rolls": ItemUsage.rolls + rolls,
                "opens": ItemUsage.opens + opens,
                "last_used_at": func.now(),
                "updated_at": func.now(),
            },
        )
        .returning(ItemUsage)
    )
    row = (await db.execute(stmt)).scalar_one()
    await db.commit()
    return row


@router.delete("", status_code=204)
async def clear_item_usage(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Forgets everything this campaign has learned - the server half of "reset my rankings"."""
    rows = (await db.execute(select(ItemUsage).where(ItemUsage.campaign_id == campaign_id))).scalars().all()
    for row in rows:
        await db.delete(row)
    await db.commit()
