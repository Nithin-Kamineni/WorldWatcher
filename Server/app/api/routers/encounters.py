import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import (
    PaginationDep,
    apply_campaign_scope,
    apply_search,
    apply_sort,
    create_kwargs,
    get_or_404,
    paginate,
)
from app.core.database import get_db
from app.models import Combat, Combatant, Creature, Encounter, EncounterCreature, EncounterTable, EncounterTableCreature
from app.schemas.combat import CombatDetail, CombatantRead
from app.schemas.common import Page, PageMeta
from app.schemas.encounters import (
    EncounterCreate,
    EncounterCreatureCreate,
    EncounterCreatureRead,
    EncounterCreatureUpdate,
    EncounterDetail,
    EncounterRead,
    EncounterTableCreatureRead,
    EncounterTableRead,
    EncounterUpdate,
)

router = APIRouter(prefix="/encounters", tags=["encounters"])


@router.get("", response_model=Page[EncounterRead])
async def list_encounters(
    page: PaginationDep,
    q: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
    scope: str = "own",
    map_id: Optional[uuid.UUID] = None,
    encounter_type: Optional[str] = None,
    resolution_type: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Encounter)
    base = apply_campaign_scope(base, Encounter, campaign_id, scope)
    if map_id:
        base = base.where(Encounter.map_id == map_id)
    if encounter_type:
        base = base.where(Encounter.encounter_type == encounter_type)
    if resolution_type:
        base = base.where(Encounter.resolution_type == resolution_type)
    base = apply_search(base, Encounter, ["name"], q)
    sorted_stmt = apply_sort(base, Encounter, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{encounter_id}", response_model=EncounterDetail)
async def get_encounter(encounter_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Encounter, encounter_id)
    creatures = (
        await db.execute(
            select(EncounterCreature)
            .where(EncounterCreature.encounter_id == encounter_id)
            .order_by(EncounterCreature.sort_order)
        )
    ).scalars().all()
    detail = EncounterDetail.model_validate(obj)
    detail.creatures = [EncounterCreatureRead.model_validate(c) for c in creatures]
    detail.random_tables = await _load_random_tables(db, encounter_id)
    return detail


async def _load_random_tables(db: AsyncSession, encounter_id: uuid.UUID) -> list[EncounterTableRead]:
    """Reassembles an encounter's random-table rows plus their creatures from the
    normalized encounter_tables/encounter_table_creatures tables (see
    Database/EncounterProcessing), so the client never needs to read the
    tables/raw_data JSONB blob for display."""
    rows = (
        await db.execute(
            select(EncounterTable).where(EncounterTable.encounter_id == encounter_id).order_by(EncounterTable.sort_order)
        )
    ).scalars().all()
    if not rows:
        return []
    table_ids = [r.id for r in rows]
    entry_rows = (
        await db.execute(
            select(EncounterTableCreature, Creature.name, Creature.creature_type)
            .outerjoin(Creature, EncounterTableCreature.creature_id == Creature.id)
            .where(EncounterTableCreature.encounter_table_id.in_(table_ids))
            .order_by(EncounterTableCreature.sort_order)
        )
    ).all()
    entries_by_table: dict[uuid.UUID, list] = {}
    for entry, creature_name, creature_type in entry_rows:
        read = EncounterTableCreatureRead.model_validate(entry)
        read.creature_name = creature_name
        read.creature_type = creature_type
        entries_by_table.setdefault(entry.encounter_table_id, []).append(read)

    result = []
    for row in rows:
        read = EncounterTableRead.model_validate(row)
        read.creatures = entries_by_table.get(row.id, [])
        result.append(read)
    return result


@router.post("", response_model=EncounterRead, status_code=201)
async def create_encounter(payload: EncounterCreate, db: AsyncSession = Depends(get_db)):
    obj = Encounter(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{encounter_id}", response_model=EncounterRead)
async def update_encounter(encounter_id: uuid.UUID, payload: EncounterUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Encounter, encounter_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{encounter_id}", status_code=204)
async def delete_encounter(encounter_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Encounter, encounter_id)
    await db.delete(obj)
    await db.commit()


# ---- Nested: encounter creatures ----


@router.get("/{encounter_id}/creatures", response_model=list[EncounterCreatureRead])
async def list_encounter_creatures(encounter_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Encounter, encounter_id)
    rows = (
        await db.execute(
            select(EncounterCreature)
            .where(EncounterCreature.encounter_id == encounter_id)
            .order_by(EncounterCreature.sort_order)
        )
    ).scalars().all()
    return rows


@router.post("/{encounter_id}/creatures", response_model=EncounterCreatureRead, status_code=201)
async def add_encounter_creature(
    encounter_id: uuid.UUID, payload: EncounterCreatureCreate, db: AsyncSession = Depends(get_db)
):
    await get_or_404(db, Encounter, encounter_id)
    data = create_kwargs(payload)
    data["encounter_id"] = encounter_id
    obj = EncounterCreature(**data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/creatures/{entry_id}", response_model=EncounterCreatureRead)
async def update_encounter_creature(
    entry_id: uuid.UUID, payload: EncounterCreatureUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await get_or_404(db, EncounterCreature, entry_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/creatures/{entry_id}", status_code=204)
async def remove_encounter_creature(entry_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, EncounterCreature, entry_id)
    await db.delete(obj)
    await db.commit()


# ---- Action: turn a prepared encounter into a live combat ----


def _modifier(score: Optional[int]) -> int:
    if score is None:
        return 0
    return math.floor((score - 10) / 2)


@router.post("/{encounter_id}/start-combat", response_model=CombatDetail, status_code=201)
async def start_combat(
    encounter_id: uuid.UUID,
    map_floor_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    encounter = await get_or_404(db, Encounter, encounter_id)
    entries = (
        await db.execute(
            select(EncounterCreature)
            .where(EncounterCreature.encounter_id == encounter_id)
            .order_by(EncounterCreature.sort_order)
        )
    ).scalars().all()

    combat = Combat(
        encounter_id=encounter.id,
        campaign_id=encounter.campaign_id,
        map_floor_id=map_floor_id,
        name=encounter.name,
        round=1,
        status="active",
        started_at=datetime.now(timezone.utc),
    )
    db.add(combat)
    await db.flush()

    for entry in entries:
        creature: Optional[Creature] = None
        if entry.creature_id:
            creature = await db.get(Creature, entry.creature_id)
        base_name = creature.name if creature else (entry.custom_name or "Creature")
        dex_mod = _modifier(creature.dexterity) if creature else 0
        quantity = max(1, entry.quantity)
        for i in range(quantity):
            display_name = base_name if quantity == 1 else f"{base_name} {i + 1}"
            combatant = Combatant(
                combat_id=combat.id,
                creature_id=creature.id if creature else None,
                display_name=display_name,
                current_hp=creature.hit_points if creature else None,
                max_hp=creature.hit_points if creature else None,
                initiative_modifier=dex_mod,
            )
            db.add(combatant)

    await db.commit()
    await db.refresh(combat)
    combatants = (await db.execute(select(Combatant).where(Combatant.combat_id == combat.id))).scalars().all()
    detail = CombatDetail.model_validate(combat)
    detail.combatants = [CombatantRead.model_validate(c) for c in combatants]
    return detail
