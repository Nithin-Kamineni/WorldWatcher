import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import Combat, Combatant
from app.schemas.combat import (
    CombatantCreate,
    CombatantRead,
    CombatantUpdate,
    CombatCreate,
    CombatDetail,
    CombatRead,
    CombatUpdate,
)
from app.schemas.common import Page, PageMeta
from app.ws.manager import manager

router = APIRouter(prefix="/combats", tags=["combats"])


def _combat_room(combat_id) -> str:
    return f"combat-{combat_id}"


@router.get("", response_model=Page[CombatRead])
async def list_combats(
    page: PaginationDep,
    campaign_id: Optional[uuid.UUID] = None,
    encounter_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Combat)
    if campaign_id:
        base = base.where(Combat.campaign_id == campaign_id)
    if encounter_id:
        base = base.where(Combat.encounter_id == encounter_id)
    if status:
        base = base.where(Combat.status == status)
    sorted_stmt = apply_sort(base, Combat, sort, "created_at", default_desc=True)
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{combat_id}", response_model=CombatDetail)
async def get_combat(combat_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Combat, combat_id)
    combatants = (
        await db.execute(
            select(Combatant).where(Combatant.combat_id == combat_id).order_by(Combatant.initiative.desc())
        )
    ).scalars().all()
    detail = CombatDetail.model_validate(obj)
    detail.combatants = [CombatantRead.model_validate(c) for c in combatants]
    return detail


@router.post("", response_model=CombatRead, status_code=201)
async def create_combat(payload: CombatCreate, db: AsyncSession = Depends(get_db)):
    obj = Combat(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{combat_id}", response_model=CombatRead)
async def update_combat(combat_id: uuid.UUID, payload: CombatUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Combat, combat_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    result = CombatRead.model_validate(obj)
    await manager.broadcast(_combat_room(combat_id), {"type": "combat:updated", "data": result.model_dump(mode="json")})
    return obj


@router.delete("/{combat_id}", status_code=204)
async def delete_combat(combat_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Combat, combat_id)
    await db.delete(obj)
    await db.commit()


# ---- Nested: combatants ----


@router.get("/{combat_id}/combatants", response_model=list[CombatantRead])
async def list_combatants(combat_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Combat, combat_id)
    rows = (
        await db.execute(
            select(Combatant).where(Combatant.combat_id == combat_id).order_by(Combatant.initiative.desc())
        )
    ).scalars().all()
    return rows


@router.post("/{combat_id}/combatants", response_model=CombatantRead, status_code=201)
async def add_combatant(combat_id: uuid.UUID, payload: CombatantCreate, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Combat, combat_id)
    data = payload.model_dump()
    data["combat_id"] = combat_id
    obj = Combatant(**data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    result = CombatantRead.model_validate(obj)
    await manager.broadcast(
        _combat_room(combat_id), {"type": "combatant:created", "data": result.model_dump(mode="json")}
    )
    return obj


@router.patch("/combatants/{combatant_id}", response_model=CombatantRead)
async def update_combatant(combatant_id: uuid.UUID, payload: CombatantUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Combatant, combatant_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    result = CombatantRead.model_validate(obj)
    await manager.broadcast(
        _combat_room(obj.combat_id), {"type": "combatant:updated", "data": result.model_dump(mode="json")}
    )
    return obj


@router.delete("/combatants/{combatant_id}", status_code=204)
async def remove_combatant(combatant_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Combatant, combatant_id)
    combat_id = obj.combat_id
    await db.delete(obj)
    await db.commit()
    await manager.broadcast(
        _combat_room(combat_id), {"type": "combatant:deleted", "data": {"id": str(combatant_id)}}
    )


# ---- Action: advance to the next combatant's turn ----


@router.post("/{combat_id}/advance-turn", response_model=CombatDetail)
async def advance_turn(combat_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    combat = await get_or_404(db, Combat, combat_id)
    combatants = (
        await db.execute(
            select(Combatant)
            .where(Combatant.combat_id == combat_id)
            .order_by(Combatant.initiative.desc(), Combatant.initiative_order.asc())
        )
    ).scalars().all()
    if not combatants:
        raise HTTPException(status_code=400, detail="Combat has no combatants yet")

    current_index = next((i for i, c in enumerate(combatants) if c.is_current_turn), None)
    if current_index is None:
        next_index = 0
    else:
        next_index = current_index + 1
        if next_index >= len(combatants):
            next_index = 0
            combat.round += 1

    for i, c in enumerate(combatants):
        c.is_current_turn = i == next_index
        if i == next_index:
            c.action_used = False
            c.bonus_action_used = False
            c.reaction_used = False
            c.movement_used = 0

    combat.current_turn = next_index
    combat.status = "active"
    await db.commit()
    await db.refresh(combat)

    detail = CombatDetail.model_validate(combat)
    detail.combatants = [CombatantRead.model_validate(c) for c in combatants]
    await manager.broadcast(
        _combat_room(combat_id), {"type": "combat:turn_advanced", "data": detail.model_dump(mode="json")}
    )
    return detail
