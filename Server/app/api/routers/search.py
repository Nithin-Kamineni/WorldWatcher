"""Global quick-search across the content tables a DM would want to
jump to instantly (creatures, spells, items) - a single search box on
the frontend can hit this instead of querying three endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Creature, Item, Spell
from app.schemas.creatures import CreatureRead
from app.schemas.items import ItemRead
from app.schemas.spells import SpellRead
from pydantic import BaseModel

router = APIRouter(prefix="/search", tags=["search"])


class SearchResults(BaseModel):
    creatures: list[CreatureRead]
    spells: list[SpellRead]
    items: list[ItemRead]


@router.get("", response_model=SearchResults)
async def global_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q}%"

    creature_stmt = select(Creature).where(Creature.name.ilike(pattern))
    if category:
        creature_stmt = creature_stmt.where(Creature.category == category)
    creature_stmt = creature_stmt.order_by(Creature.name).limit(limit)

    spell_stmt = select(Spell).where(Spell.name.ilike(pattern)).order_by(Spell.name).limit(limit)
    item_stmt = select(Item).where(Item.name.ilike(pattern)).order_by(Item.name).limit(limit)

    creatures = (await db.execute(creature_stmt)).scalars().all()
    spells = (await db.execute(spell_stmt)).scalars().all()
    items = (await db.execute(item_stmt)).scalars().all()

    return SearchResults(creatures=creatures, spells=spells, items=items)
