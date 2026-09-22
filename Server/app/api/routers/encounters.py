import math
import re
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
from app.models import (
    Combat,
    Combatant,
    Creature,
    Encounter,
    EncounterCombatBlock,
    EncounterCreature,
    EncounterExplorationBlock,
    EncounterNpc,
    EncounterReward,
    EncounterSocialBlock,
    EncounterTable,
    EncounterTableCreature,
    EncounterTag,
    Item,
)
from app.schemas.combat import CombatDetail, CombatantRead
from app.schemas.common import Page, PageMeta
from app.schemas.encounters import (
    EncounterCombatBlockRead,
    EncounterCombatBlockWrite,
    EncounterCreate,
    EncounterCreatureCreate,
    EncounterCreatureRead,
    EncounterCreatureUpdate,
    EncounterDetail,
    EncounterExplorationBlockRead,
    EncounterExplorationBlockWrite,
    EncounterNpcCreate,
    EncounterNpcRead,
    EncounterNpcUpdate,
    EncounterRead,
    EncounterSocialBlockRead,
    EncounterSocialBlockWrite,
    EncounterTableCreatureRead,
    EncounterTableRead,
    EncounterUpdate,
    RewardDetails,
)
from app.schemas.random_tables import TagIdsWrite

router = APIRouter(prefix="/encounters", tags=["encounters"])

_COUNT_WORDS = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}


def _quantity_formula(prose: Optional[str], creature_name: Optional[str], fallback: int) -> str:
    if not prose or not creature_name:
        return str(fallback)
    pattern = rf"(?:^|\b)(\d+d\d+(?:\s*[+-]\s*\d+)?|\d+|{'|'.join(_COUNT_WORDS)})\s+{re.escape(creature_name)}s?\b"
    match = re.search(pattern, prose, re.IGNORECASE)
    if not match:
        return str(fallback)
    token = match.group(1).lower().replace(" ", "")
    return str(_COUNT_WORDS.get(token, token))


@router.get("", response_model=Page[EncounterRead])
async def list_encounters(
    page: PaginationDep,
    q: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
    scope: str = "own",
    map_id: Optional[uuid.UUID] = None,
    encounter_type: Optional[str] = None,
    resolution_type: Optional[str] = None,
    primary_type: Optional[str] = None,
    category_id: Optional[uuid.UUID] = None,
    tag_ids: Optional[str] = None,  # csv of UUIDs, ANY-match
    status: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Encounter)
    base = apply_campaign_scope(base, Encounter, campaign_id, scope)
    if map_id:
        base = base.where(Encounter.map_id == map_id)
    if encounter_type:
        base = base.where(Encounter.encounter_type == encounter_type)
    if primary_type:
        base = base.where(Encounter.primary_type == primary_type)
    if category_id:
        base = base.where(Encounter.category_id == category_id)
    if status:
        base = base.where(Encounter.status == status)
    if tag_ids:
        ids = [uuid.UUID(v) for v in tag_ids.split(",") if v]
        if ids:
            base = base.where(Encounter.id.in_(select(EncounterTag.encounter_id).where(EncounterTag.tag_id.in_(ids))))
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
    creature_ids = {entry.creature_id for entry in creatures if entry.creature_id}
    npc_rows_raw = (
        await db.execute(select(EncounterNpc).where(EncounterNpc.encounter_id == encounter_id).order_by(EncounterNpc.sort_order))
    ).scalars().all()
    creature_ids.update(n.npc_id for n in npc_rows_raw)
    creature_lookup: dict[uuid.UUID, Creature] = {}
    if creature_ids:
        rows = (await db.execute(select(Creature).where(Creature.id.in_(creature_ids)))).scalars().all()
        creature_lookup = {c.id: c for c in rows}
    detail.creatures = []
    for entry in creatures:
        read = EncounterCreatureRead.model_validate(entry)
        linked = creature_lookup.get(entry.creature_id) if entry.creature_id else None
        stored_formula = entry.raw_data.get("quantity_formula") if isinstance(entry.raw_data, dict) else None
        read.quantity_formula = stored_formula or _quantity_formula(obj.description, linked.name if linked else None, entry.quantity)
        if linked:
            read.creature_name = linked.name
            read.creature_type = linked.creature_type
            read.creature_cr = linked.challenge_rating_display
            read.token_asset_id = linked.token_asset_id
            read.portrait_asset_id = linked.portrait_asset_id
        detail.creatures.append(read)
    detail.random_tables = await _load_random_tables(db, encounter_id)
    detail.rewards = await _load_rewards(db, encounter_id)
    detail.npcs = []
    for n in npc_rows_raw:
        read = EncounterNpcRead.model_validate(n)
        linked = creature_lookup.get(n.npc_id)
        if linked:
            read.npc_name = linked.name
            read.token_asset_id = linked.token_asset_id
            read.portrait_asset_id = linked.portrait_asset_id
        detail.npcs.append(read)
    detail.tag_ids = (await db.execute(select(EncounterTag.tag_id).where(EncounterTag.encounter_id == encounter_id))).scalars().all()
    combat_block = await db.get(EncounterCombatBlock, encounter_id)
    if combat_block:
        detail.combat_block = EncounterCombatBlockRead.model_validate(combat_block)
    social_block = await db.get(EncounterSocialBlock, encounter_id)
    if social_block:
        detail.social_block = EncounterSocialBlockRead.model_validate(social_block)
    exploration_block = await db.get(EncounterExplorationBlock, encounter_id)
    if exploration_block:
        detail.exploration_block = EncounterExplorationBlockRead.model_validate(exploration_block)
    return detail


async def _load_rewards(db: AsyncSession, encounter_id: uuid.UUID) -> list[RewardDetails]:
    """Task 11.1: reads encounter_rewards and hydrates the linked magic item, so a
    reward of kind='item' renders from the items row rather than from a restatement
    of its name. An item_id whose row has since been deleted degrades to whatever
    `description` holds rather than vanishing."""
    rows = (
        await db.execute(
            select(EncounterReward, Item)
            .outerjoin(Item, EncounterReward.item_id == Item.id)
            .where(EncounterReward.encounter_id == encounter_id)
            .order_by(EncounterReward.sort_order)
        )
    ).all()
    result: list[RewardDetails] = []
    for row, item in rows:
        read = RewardDetails.model_validate(row)
        if item:
            read.item_name = item.name
            read.item_rarity = item.rarity
        result.append(read)
    return result


async def _replace_rewards(db: AsyncSession, encounter_id: uuid.UUID, rewards: list[RewardDetails]) -> None:
    """Whole-list replace, matching replace_encounter_tags: the reward list is edited
    inline in the encounter form and saved with it, so there are no per-row endpoints."""
    existing = (
        await db.execute(select(EncounterReward).where(EncounterReward.encounter_id == encounter_id))
    ).scalars().all()
    for row in existing:
        await db.delete(row)
    await db.flush()
    for i, reward in enumerate(rewards):
        db.add(
            EncounterReward(
                encounter_id=encounter_id,
                kind=reward.kind,
                # Only kind='item' carries an FK - keeping one on any other kind would
                # make the reference meaningless.
                item_id=reward.item_id if reward.kind == "item" else None,
                description=reward.description,
                quantity=max(1, reward.quantity),
                sort_order=reward.sort_order or i,
            )
        )


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
            select(
                EncounterTableCreature,
                Creature.name,
                Creature.creature_type,
                Creature.challenge_rating_display,
                Creature.token_asset_id,
                Creature.portrait_asset_id,
            )
            .outerjoin(Creature, EncounterTableCreature.creature_id == Creature.id)
            .where(EncounterTableCreature.encounter_table_id.in_(table_ids))
            .order_by(EncounterTableCreature.sort_order)
        )
    ).all()
    entries_by_table: dict[uuid.UUID, list] = {}
    for entry, creature_name, creature_type, creature_cr, token_asset_id, portrait_asset_id in entry_rows:
        read = EncounterTableCreatureRead.model_validate(entry)
        read.creature_name = creature_name
        read.creature_type = creature_type
        read.creature_cr = creature_cr
        read.token_asset_id = token_asset_id
        read.portrait_asset_id = portrait_asset_id
        entries_by_table.setdefault(entry.encounter_table_id, []).append(read)

    result = []
    for row in rows:
        read = EncounterTableRead.model_validate(row)
        read.creatures = entries_by_table.get(row.id, [])
        result.append(read)
    return result


@router.post("", response_model=EncounterRead, status_code=201)
async def create_encounter(payload: EncounterCreate, db: AsyncSession = Depends(get_db)):
    # rewards live in their own table now (Task 11.1), so they are never a column value.
    fields = {k: v for k, v in create_kwargs(payload).items() if k != "rewards"}
    obj = Encounter(**fields)
    db.add(obj)
    await db.flush()
    await _replace_rewards(db, obj.id, payload.rewards)
    await db.commit()
    await db.refresh(obj)
    read = EncounterRead.model_validate(obj)
    read.rewards = await _load_rewards(db, obj.id)
    return read


@router.patch("/{encounter_id}", response_model=EncounterRead)
async def update_encounter(encounter_id: uuid.UUID, payload: EncounterUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Encounter, encounter_id)
    data = payload.model_dump(exclude_unset=True)
    rewards = data.pop("rewards", None)
    for key, value in data.items():
        setattr(obj, key, value)
    if rewards is not None:
        # Absent means "leave rewards alone"; an empty list means "clear them".
        await _replace_rewards(db, encounter_id, payload.rewards or [])
    await db.commit()
    await db.refresh(obj)
    read = EncounterRead.model_validate(obj)
    read.rewards = await _load_rewards(db, encounter_id)
    return read


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


# ---- Nested: NPC roster (Task 9.1) ----


@router.get("/{encounter_id}/npcs", response_model=list[EncounterNpcRead])
async def list_encounter_npcs(encounter_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Encounter, encounter_id)
    rows = (
        await db.execute(select(EncounterNpc).where(EncounterNpc.encounter_id == encounter_id).order_by(EncounterNpc.sort_order))
    ).scalars().all()
    return rows


@router.post("/{encounter_id}/npcs", response_model=EncounterNpcRead, status_code=201)
async def add_encounter_npc(encounter_id: uuid.UUID, payload: EncounterNpcCreate, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Encounter, encounter_id)
    data = create_kwargs(payload)
    data["encounter_id"] = encounter_id
    obj = EncounterNpc(**data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/npcs/{entry_id}", response_model=EncounterNpcRead)
async def update_encounter_npc(entry_id: uuid.UUID, payload: EncounterNpcUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, EncounterNpc, entry_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/npcs/{entry_id}", status_code=204)
async def remove_encounter_npc(entry_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, EncounterNpc, entry_id)
    await db.delete(obj)
    await db.commit()


# ---- Blocks: combat/social/exploration (Tasks 8-10, optional 1:1) ----


@router.put("/{encounter_id}/blocks/combat", response_model=EncounterCombatBlockRead)
async def upsert_combat_block(encounter_id: uuid.UUID, payload: EncounterCombatBlockWrite, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Encounter, encounter_id)
    obj = await db.get(EncounterCombatBlock, encounter_id)
    if obj is None:
        obj = EncounterCombatBlock(encounter_id=encounter_id)
        db.add(obj)
    for key, value in payload.model_dump().items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{encounter_id}/blocks/combat", status_code=204)
async def delete_combat_block(encounter_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await db.get(EncounterCombatBlock, encounter_id)
    if obj:
        await db.delete(obj)
        await db.commit()


@router.put("/{encounter_id}/blocks/social", response_model=EncounterSocialBlockRead)
async def upsert_social_block(encounter_id: uuid.UUID, payload: EncounterSocialBlockWrite, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Encounter, encounter_id)
    obj = await db.get(EncounterSocialBlock, encounter_id)
    if obj is None:
        obj = EncounterSocialBlock(encounter_id=encounter_id)
        db.add(obj)
    for key, value in payload.model_dump().items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{encounter_id}/blocks/social", status_code=204)
async def delete_social_block(encounter_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await db.get(EncounterSocialBlock, encounter_id)
    if obj:
        await db.delete(obj)
        await db.commit()


@router.put("/{encounter_id}/blocks/exploration", response_model=EncounterExplorationBlockRead)
async def upsert_exploration_block(encounter_id: uuid.UUID, payload: EncounterExplorationBlockWrite, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Encounter, encounter_id)
    obj = await db.get(EncounterExplorationBlock, encounter_id)
    if obj is None:
        obj = EncounterExplorationBlock(encounter_id=encounter_id)
        db.add(obj)
    for key, value in payload.model_dump().items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{encounter_id}/blocks/exploration", status_code=204)
async def delete_exploration_block(encounter_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await db.get(EncounterExplorationBlock, encounter_id)
    if obj:
        await db.delete(obj)
        await db.commit()


# ---- Tags (Task 3.1.2 - encounter_tag, same vocabulary as random tables) ----


@router.put("/{encounter_id}/tags", response_model=list[uuid.UUID])
async def replace_encounter_tags(encounter_id: uuid.UUID, payload: TagIdsWrite, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Encounter, encounter_id)
    existing = (await db.execute(select(EncounterTag).where(EncounterTag.encounter_id == encounter_id))).scalars().all()
    for row in existing:
        await db.delete(row)
    await db.flush()
    for tag_id in payload.tag_ids:
        db.add(EncounterTag(encounter_id=encounter_id, tag_id=tag_id))
    await db.commit()
    return payload.tag_ids


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
