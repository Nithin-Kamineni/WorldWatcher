"""Task 1/5/11: the random-table core engine - CRUD, structure validation,
tagging, and the format-dispatching roll endpoint."""
import uuid
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import Pagination, apply_campaign_scope, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import (
    Encounter,
    EncounterCombatBlock,
    EncounterCreature,
    EncounterTable,
    EncounterTableCreature,
    Creature,
    RandomTable,
    RandomTableTag,
    TableColumn,
    TableEntry,
    TableEntryTag,
    TableFormat,
)
from app.schemas.common import Page, PageMeta
from app.schemas.random_tables import (
    RandomTableCreate,
    RandomTableDetail,
    RandomTableRead,
    RandomTableUpdate,
    RollRequest,
    RollResult,
    RollResultItem,
    RolledDieOut,
    TableColumnRead,
    TableColumnWrite,
    TableEntryRead,
    TableStructureWrite,
    TagIdsWrite,
)
from app.services import roll_engine

router = APIRouter(prefix="/random-tables", tags=["random-tables"])

# Formats that must fully cover their column's die range with no gaps/overlap
# (Task 5.2.3) - a single roll always lands on exactly one entry. Pool/order/
# band-based formats (weighted_pool, deck, clock, ...) don't need this.
RANGE_STRICT_FORMATS = {"lookup", "reference", "scene_generator", "generator", "cascading", "branching", "check_table"}
MAX_CASCADE_DEPTH = 6

CR_XP = {
    "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100,
    "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200,
    "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000,
    "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
    "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000,
}


def _average_quantity(formula: str) -> float:
    match = re.fullmatch(r"\s*(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?\s*", formula, re.IGNORECASE)
    if match:
        average = int(match.group(1)) * (int(match.group(2)) + 1) / 2
        if match.group(3):
            average += int(match.group(4)) * (1 if match.group(3) == "+" else -1)
        return max(0, average)
    try:
        return max(0, float(formula))
    except ValueError:
        return 1


def _creature_xp(creature: Optional[Creature]) -> int:
    return CR_XP.get((creature.challenge_rating_display or "").strip(), 0) if creature else 0


def _quantity_in_prose(prose: Optional[str], creature_name: Optional[str], fallback: int) -> str:
    if not prose or not creature_name:
        return str(fallback)
    words = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
    match = re.search(rf"(?:^|\b)(\d+d\d+(?:\s*[+-]\s*\d+)?|\d+|{'|'.join(words)})\s+{re.escape(creature_name)}s?\b", prose, re.IGNORECASE)
    if not match:
        return str(fallback)
    token = match.group(1).lower().replace(" ", "")
    return str(words.get(token, token))


# ---------------------------------------------------------------- helpers


def _validate_structure(format_slug: str, columns: list[TableColumnWrite]) -> None:
    if format_slug not in RANGE_STRICT_FORMATS:
        return
    for column in columns:
        lo = column.die_count * 1 + column.die_modifier
        hi = column.die_count * column.die_sides + column.die_modifier
        covered: set[int] = set()
        for entry in sorted(column.entries, key=lambda e: e.min if e.min is not None else 0):
            if entry.min is None or entry.max is None:
                raise HTTPException(status_code=400, detail=f"Column '{column.name}': every entry needs min/max for format '{format_slug}'")
            if entry.min > entry.max or entry.min < lo or entry.max > hi:
                raise HTTPException(
                    status_code=400,
                    detail=f"Column '{column.name}': entry range {entry.min}-{entry.max} is outside the column's die range {lo}-{hi}",
                )
            rng = set(range(entry.min, entry.max + 1))
            overlap = covered & rng
            if overlap:
                raise HTTPException(status_code=400, detail=f"Column '{column.name}': entry range {entry.min}-{entry.max} overlaps another entry")
            covered |= rng
        missing = set(range(lo, hi + 1)) - covered
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Column '{column.name}': ranges don't fully cover {lo}-{hi} (missing: {sorted(missing)[:10]}{'…' if len(missing) > 10 else ''})",
            )


async def _replace_structure(db: AsyncSession, table: RandomTable, columns: list[TableColumnWrite]) -> None:
    format_row = await db.get(TableFormat, table.format_id)
    _validate_structure(format_row.slug if format_row else "lookup", columns)

    existing_columns = (await db.execute(select(TableColumn).where(TableColumn.table_id == table.id))).scalars().all()
    for col in existing_columns:
        await db.delete(col)
    await db.flush()

    for i, col_in in enumerate(columns):
        col = TableColumn(
            table_id=table.id,
            name=col_in.name,
            die_count=col_in.die_count,
            die_sides=col_in.die_sides,
            die_modifier=col_in.die_modifier,
            sort_order=col_in.sort_order or i,
        )
        db.add(col)
        await db.flush()
        for j, entry_in in enumerate(col_in.entries):
            entry = TableEntry(
                column_id=col.id,
                min=entry_in.min,
                max=entry_in.max,
                secondary_min=entry_in.secondary_min,
                secondary_max=entry_in.secondary_max,
                weight=entry_in.weight,
                kind=entry_in.kind,
                text=entry_in.text,
                encounter_id=entry_in.encounter_id,
                target_table_id=entry_in.target_table_id,
                creature_id=entry_in.creature_id,
                npc_id=entry_in.npc_id,
                item_id=entry_in.item_id,
                bundle=entry_in.bundle,
                notes=entry_in.notes,
                sort_order=entry_in.sort_order or j,
            )
            db.add(entry)
            await db.flush()
            for tag_id in entry_in.tag_ids:
                db.add(TableEntryTag(entry_id=entry.id, tag_id=tag_id))


async def _load_detail(db: AsyncSession, table: RandomTable) -> RandomTableDetail:
    columns = (await db.execute(select(TableColumn).where(TableColumn.table_id == table.id).order_by(TableColumn.sort_order))).scalars().all()
    detail = RandomTableDetail.model_validate(table)
    detail.tag_ids = (await db.execute(select(RandomTableTag.tag_id).where(RandomTableTag.table_id == table.id))).scalars().all()
    out_columns = []
    for col in columns:
        entries = (await db.execute(select(TableEntry).where(TableEntry.column_id == col.id).order_by(TableEntry.sort_order))).scalars().all()
        col_read = TableColumnRead.model_validate(col)
        entry_reads = []
        for e in entries:
            er = TableEntryRead.model_validate(e)
            er.tag_ids = (await db.execute(select(TableEntryTag.tag_id).where(TableEntryTag.entry_id == e.id))).scalars().all()
            ref_id = e.encounter_id or e.target_table_id or e.creature_id or e.npc_id or e.item_id
            if e.kind == "table_ref" and ref_id:
                target = await db.get(RandomTable, ref_id)
                er.ref_hydrated = {"id": str(target.id), "name": target.name, "description": target.description} if target else None
            else:
                er.ref_hydrated = await _hydrate_ref(db, e.kind, ref_id)
            entry_reads.append(er)
        col_read.entries = entry_reads
        out_columns.append(col_read)
    detail.columns = out_columns
    return detail


# ---------------------------------------------------------------- CRUD


@router.get("", response_model=Page[RandomTableRead])
async def list_random_tables(
    # The category browser needs the summary library in one request so it can
    # calculate counts for every branch.  Keep this larger cap local to random
    # tables rather than making every paginated resource accept huge pages.
    limit: int = Query(50, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    q: Optional[str] = None,
    category_id: Optional[uuid.UUID] = None,
    format_id: Optional[uuid.UUID] = None,
    format_slug: Optional[str] = None,
    tag_ids: Optional[str] = None,  # csv of UUIDs, ANY-match
    campaign_id: Optional[uuid.UUID] = None,
    scope: str = "own_or_global",
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Task 1.3/11.3: combinable category + tags + format + full-text filter."""
    base = select(RandomTable)
    base = apply_campaign_scope(base, RandomTable, campaign_id, scope)
    if category_id:
        base = base.where(RandomTable.category_id == category_id)
    if format_id:
        base = base.where(RandomTable.format_id == format_id)
    if format_slug:
        fmt = (await db.execute(select(TableFormat.id).where(TableFormat.slug == format_slug))).scalar_one_or_none()
        base = base.where(RandomTable.format_id == fmt if fmt else False)
    if tag_ids:
        ids = [uuid.UUID(v) for v in tag_ids.split(",") if v]
        if ids:
            base = base.where(RandomTable.id.in_(select(RandomTableTag.table_id).where(RandomTableTag.tag_id.in_(ids))))
    base = apply_search(base, RandomTable, ["name", "description"], q)
    sorted_stmt = apply_sort(base, RandomTable, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, Pagination(limit=limit, offset=offset))

    # Load tags for the entire page at once.  The old per-table lookup made a
    # 500-row page issue 502 SQL queries (count + page + 500 tag queries), which
    # was the main source of long and highly variable browser load times.
    tags_by_table: dict[uuid.UUID, list[uuid.UUID]] = {}
    if items:
        tag_rows = (
            await db.execute(
                select(RandomTableTag.table_id, RandomTableTag.tag_id).where(
                    RandomTableTag.table_id.in_([item.id for item in items])
                )
            )
        ).all()
        for table_id, tag_id in tag_rows:
            tags_by_table.setdefault(table_id, []).append(tag_id)

    reads = []
    for item in items:
        r = RandomTableRead.model_validate(item)
        r.tag_ids = tags_by_table.get(item.id, [])
        reads.append(r)
    return Page(items=reads, meta=PageMeta(**meta))


@router.get("/{table_id}", response_model=RandomTableDetail)
async def get_random_table(table_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, RandomTable, table_id)
    return await _load_detail(db, obj)


@router.post("", response_model=RandomTableDetail, status_code=201)
async def create_random_table(payload: RandomTableCreate, db: AsyncSession = Depends(get_db)):
    data = payload.model_dump(exclude={"columns", "tag_ids"})
    if not data.get("id"):
        data.pop("id", None)
    obj = RandomTable(**data)
    db.add(obj)
    await db.flush()
    await _replace_structure(db, obj, payload.columns)
    for tag_id in payload.tag_ids:
        db.add(RandomTableTag(table_id=obj.id, tag_id=tag_id))
    await db.commit()
    await db.refresh(obj)
    return await _load_detail(db, obj)


@router.patch("/{table_id}", response_model=RandomTableDetail)
async def update_random_table(table_id: uuid.UUID, payload: RandomTableUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, RandomTable, table_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return await _load_detail(db, obj)


@router.put("/{table_id}/structure", response_model=RandomTableDetail)
async def replace_random_table_structure(table_id: uuid.UUID, payload: TableStructureWrite, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, RandomTable, table_id)
    await _replace_structure(db, obj, payload.columns)
    await db.commit()
    await db.refresh(obj)
    return await _load_detail(db, obj)


@router.put("/{table_id}/tags", response_model=RandomTableDetail)
async def replace_random_table_tags(table_id: uuid.UUID, payload: TagIdsWrite, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, RandomTable, table_id)
    existing = (await db.execute(select(RandomTableTag).where(RandomTableTag.table_id == table_id))).scalars().all()
    for row in existing:
        await db.delete(row)
    await db.flush()
    for tag_id in payload.tag_ids:
        db.add(RandomTableTag(table_id=table_id, tag_id=tag_id))
    await db.commit()
    await db.refresh(obj)
    return await _load_detail(db, obj)


@router.delete("/{table_id}", status_code=204)
async def delete_random_table(table_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, RandomTable, table_id)
    await db.delete(obj)
    await db.commit()


@router.post("/{table_id}/clone", response_model=RandomTableDetail, status_code=201)
async def clone_random_table(table_id: uuid.UUID, campaign_id: Optional[uuid.UUID] = None, db: AsyncSession = Depends(get_db)):
    """Task 11.4: curated content is read-only-ish - clone-to-edit is how a
    DM turns a system table into their own editable homebrew copy."""
    source = await get_or_404(db, RandomTable, table_id)
    detail = await _load_detail(db, source)
    clone = RandomTable(
        campaign_id=campaign_id,
        name=f"{source.name} (copy)",
        description=source.description,
        category_id=source.category_id,
        format_id=source.format_id,
        trigger_situation=source.trigger_situation,
        image_url=source.image_url,
        combine_template=source.combine_template,
        source_book=source.source_book,
        format_config=source.format_config,
        is_system=False,
    )
    db.add(clone)
    await db.flush()
    columns_write = [
        TableColumnWrite(
            name=c.name, die_count=c.die_count, die_sides=c.die_sides, die_modifier=c.die_modifier, sort_order=c.sort_order,
            entries=[e.model_dump(exclude={"id"}) for e in c.entries],
        )
        for c in detail.columns
    ]
    await _replace_structure(db, clone, columns_write)
    for tag_id in detail.tag_ids:
        db.add(RandomTableTag(table_id=clone.id, tag_id=tag_id))
    await db.commit()
    await db.refresh(clone)
    return await _load_detail(db, clone)


# ---------------------------------------------------------------- roll engine


async def _hydrate_ref(db: AsyncSession, kind: str, ref_id: Optional[uuid.UUID]) -> Optional[dict]:
    if not ref_id:
        return None
    if kind == "encounter_ref":
        obj = await db.get(Encounter, ref_id)
        if not obj:
            return None
        roster_rows = (await db.execute(
            select(EncounterCreature, Creature)
            .outerjoin(Creature, EncounterCreature.creature_id == Creature.id)
            .where(EncounterCreature.encounter_id == ref_id)
            .order_by(EncounterCreature.sort_order)
        )).all()
        table_rows = (await db.execute(
            select(EncounterTableCreature, Creature)
            .join(EncounterTable, EncounterTable.id == EncounterTableCreature.encounter_table_id)
            .outerjoin(Creature, EncounterTableCreature.creature_id == Creature.id)
            .where(EncounterTable.encounter_id == ref_id)
            .order_by(EncounterTable.sort_order, EncounterTableCreature.sort_order)
        )).all()
        creature_labels: list[str] = []
        creature_types: set[str] = set()
        creature_crs: set[str] = set()
        calculated_xp = 0.0
        for entry, creature in roster_rows:
            roster_name = creature.name if creature else entry.custom_name or 'creature'
            formula = _quantity_in_prose(obj.description, roster_name, entry.quantity)
            creature_labels.append(f"{formula} {roster_name}")
            if creature and creature.creature_type:
                creature_types.add(creature.creature_type)
            if creature and creature.challenge_rating_display:
                creature_crs.add(creature.challenge_rating_display)
            calculated_xp += _average_quantity(formula) * _creature_xp(creature)
        for entry, creature in table_rows:
            creature_labels.append(f"{entry.quantity_formula} {creature.name if creature else entry.creature_name_raw}")
            if creature and creature.creature_type:
                creature_types.add(creature.creature_type)
            if creature and creature.challenge_rating_display:
                creature_crs.add(creature.challenge_rating_display)
            calculated_xp += _average_quantity(entry.quantity_formula) * _creature_xp(creature)
        imported_labels: list[str] = []
        imported_xp = 0.0
        for imported_table in obj.tables or []:
            for row in imported_table.get("table", []):
                for imported_creature in row.get("creatures", []):
                    formula = imported_creature.get("countDice") or imported_creature.get("countFixed") or 1
                    imported_name = imported_creature.get('name', 'creature')
                    imported_labels.append(f"{formula} {imported_name}")
                    linked = next((creature for entry, creature in roster_rows if creature and creature.name.casefold() == imported_name.casefold()), None)
                    imported_xp += _average_quantity(str(formula)) * _creature_xp(linked)
        if imported_labels:
            creature_labels = list(dict.fromkeys(imported_labels))
            if imported_xp:
                calculated_xp = imported_xp
        combat = await db.get(EncounterCombatBlock, ref_id)
        return {
            "id": str(obj.id),
            "name": obj.name,
            "primary_type": obj.primary_type,
            "challenge_rating": obj.computed_cr or obj.challenge_rating_display or (", ".join(sorted(creature_crs)) if creature_crs else None),
            "difficulty": obj.difficulty,
            "xp": (round(calculated_xp) if calculated_xp else None) or obj.computed_adjusted_xp or (combat.computed_xp if combat else None),
            "creatures": creature_labels,
            "creature_count": " + ".join(creature_labels) if creature_labels else None,
            "creature_types": sorted(creature_types),
            "description": obj.description,
            "encounter_type": obj.encounter_type,
            "status": obj.status,
            "theme": obj.theme,
            "objective": obj.objective,
            "tags": obj.tags or [],
        }
    if kind in ("creature_ref", "npc_ref"):
        obj = await db.get(Creature, ref_id)
        return {
            "id": str(obj.id),
            "name": obj.name,
            "category": obj.category,
            "creature_type": obj.creature_type,
            "challenge_rating": obj.challenge_rating_display,
            "image_src": f"/api/assets/{obj.token_asset_id}/file" if obj.token_asset_id else None,
        } if obj else None
    if kind == "item_ref":
        from app.models import Item

        obj = await db.get(Item, ref_id)
        return {"id": str(obj.id), "name": obj.name} if obj else None
    return None


async def _roll_table(db: AsyncSession, table: RandomTable, req: RollRequest) -> RollResult:
    fmt = await db.get(TableFormat, table.format_id)
    format_slug = fmt.slug if fmt else "lookup"
    columns = (await db.execute(select(TableColumn).where(TableColumn.table_id == table.id).order_by(TableColumn.sort_order))).scalars().all()
    format_config = table.format_config or {}

    async def constrained_entries(column: TableColumn) -> tuple[list[TableEntry], bool]:
        entries = (await db.execute(select(TableEntry).where(TableEntry.column_id == column.id))).scalars().all()
        if not req.filter_tag_ids or not entries:
            return list(entries), False

        from app.models import Tag

        requested_rows = (await db.execute(select(Tag).where(Tag.id.in_(req.filter_tag_ids)))).scalars().all()
        requested_by_namespace: dict[str, set[uuid.UUID]] = {}
        for tag in requested_rows:
            requested_by_namespace.setdefault(tag.namespace, set()).add(tag.id)
        if not requested_by_namespace:
            return list(entries), False

        entry_ids = [entry.id for entry in entries]
        assignments = (
            await db.execute(
                select(TableEntryTag.entry_id, TableEntryTag.tag_id, Tag.namespace)
                .join(Tag, Tag.id == TableEntryTag.tag_id)
                .where(TableEntryTag.entry_id.in_(entry_ids))
            )
        ).all()
        table_namespaces = {namespace for _entry_id, _tag_id, namespace in assignments}
        active_namespaces = set(requested_by_namespace).intersection(table_namespaces)
        if not active_namespaces:
            return list(entries), False

        tags_by_entry: dict[uuid.UUID, dict[str, set[uuid.UUID]]] = {}
        for entry_id, tag_id, namespace in assignments:
            tags_by_entry.setdefault(entry_id, {}).setdefault(namespace, set()).add(tag_id)
        return [
            entry for entry in entries
            if all(tags_by_entry.get(entry.id, {}).get(namespace, set()).intersection(requested_by_namespace[namespace])
                   for namespace in active_namespaces)
        ], True

    items: list[RollResultItem] = []
    gate_passed: Optional[bool] = None

    if format_slug == "oracle":
        outcome = roll_engine.pick_oracle(max(0.0, min(1.0, req.likelihood)), columns[0].name if columns else None)
        return await _outcome_to_result(db, table, format_slug, [outcome])

    if format_slug == "chance_gate":
        chance = req.chance_percent if req.chance_percent is not None else format_config.get("chance_percent", 15)
        passed, die = roll_engine.pick_chance_gate(chance)
        gate_passed = passed
        item = RollResultItem(dice=[RolledDieOut(sides=100, result=die.result)], total=die.result, kind="gate", text="triggered" if passed else "clear")
        if passed and columns:
            entries, _constraints_applied = await constrained_entries(columns[0])
            outcome = roll_engine.pick_lookup([_entry_dict(e) for e in entries], roll_engine.DieSpec(columns[0].die_count, columns[0].die_sides, columns[0].die_modifier))
            item.nested = await _outcome_to_result(db, table, format_slug, [outcome])
            if outcome.kind == "table_ref" and outcome.ref_id and req.depth < MAX_CASCADE_DEPTH:
                target = await db.get(RandomTable, uuid.UUID(outcome.ref_id))
                if target:
                    item.nested = await _roll_table(db, target, RollRequest(depth=req.depth + 1, state=req.state))
        items.append(item)
        return RollResult(table_id=table.id, table_name=table.name, format_slug=format_slug, items=items, gate_passed=gate_passed)

    if format_slug == "sequence":
        length = req.sequence_length or format_config.get("sequence_length", 5)
        column = columns[0] if columns else None
        if column:
            column_entries, constraints_applied = await constrained_entries(column)
            entries = [_entry_dict(e) for e in column_entries]
            if constraints_applied:
                for entry in entries:
                    entry.update({"min": None, "max": None, "secondary_min": None, "secondary_max": None})
            drawn: set[str] = set()
            for _ in range(length):
                outcome = roll_engine.pick_deck(entries, drawn, column.name)
                if outcome.entry_id:
                    drawn.add(outcome.entry_id)
                items.append(await _outcome_to_item(db, format_slug, outcome))
        return RollResult(table_id=table.id, table_name=table.name, format_slug=format_slug, items=items)

    for column in columns:
        column_entries, constraints_applied = await constrained_entries(column)
        entries = [_entry_dict(e) for e in column_entries]
        if not entries:
            continue
        # Once a tagged subset has been selected, its original printed ranges
        # are sparse. Treat that subset as a fresh positional pool so every
        # eligible option remains reachable and no ineligible range can win.
        if constraints_applied:
            for entry in entries:
                entry.update({"min": None, "max": None, "secondary_min": None, "secondary_max": None})
        drawn_ids = {str(i) for i in req.drawn_entry_ids}
        outcome = roll_engine.roll_column(
            {"die_count": column.die_count, "die_sides": column.die_sides, "die_modifier": column.die_modifier, "name": column.name},
            entries,
            format_slug,
            modifier=req.modifier,
            counter=req.counter,
            drawn_ids=drawn_ids,
            row_sides=int(format_config.get("row_die_sides", column.die_sides)),
            col_sides=int(format_config.get("col_die_sides", column.die_sides)),
        )
        item = await _outcome_to_item(db, format_slug, outcome)

        if format_slug == "countdown_deck":
            doom_per_draw = int(format_config.get("doom_per_draw", 1))
            doom_max = int(format_config.get("doom_max", 10))
            doom = min(doom_max, (len(drawn_ids) + 1) * doom_per_draw)
            item.extra.update({"doom": doom, "doom_max": doom_max, "doom_complete": doom >= doom_max})

        if format_slug in ("cascading", "branching") and outcome.kind == "table_ref" and outcome.ref_id and req.depth < MAX_CASCADE_DEPTH:
            target = await db.get(RandomTable, uuid.UUID(outcome.ref_id))
            if target:
                item.nested = await _roll_table(db, target, RollRequest(depth=req.depth + 1, state=req.state))
        elif format_slug == "branching" and req.depth < MAX_CASCADE_DEPTH:
            rules = format_config.get("branch_rules", [])
            for rule in rules if isinstance(rules, list) else []:
                if not isinstance(rule, dict):
                    continue
                state_key, equals = rule.get("state_key"), rule.get("equals")
                entry_match = not rule.get("entry_id") or str(rule.get("entry_id")) == str(outcome.entry_id)
                if entry_match and state_key and req.state.get(state_key) == equals and rule.get("target_table_id"):
                    target = await db.get(RandomTable, uuid.UUID(str(rule["target_table_id"])))
                    if target:
                        item.nested = await _roll_table(db, target, RollRequest(depth=req.depth + 1, state=req.state))
                    break
        items.append(item)

    combined_text = None
    if table.combine_template and items:
        try:
            combined_text = table.combine_template.format(**{i.column_name or f"col{n}": (i.resolved_text or i.text or "") for n, i in enumerate(items)})
        except (KeyError, IndexError):
            combined_text = None

    return RollResult(table_id=table.id, table_name=table.name, format_slug=format_slug, items=items, combined_text=combined_text)


def _entry_dict(e: TableEntry) -> dict:
    return {
        "id": e.id, "min": e.min, "max": e.max, "secondary_min": e.secondary_min, "secondary_max": e.secondary_max,
        "weight": e.weight, "kind": e.kind, "text": e.text, "encounter_id": e.encounter_id,
        "target_table_id": e.target_table_id, "creature_id": e.creature_id, "npc_id": e.npc_id, "item_id": e.item_id,
        "sort_order": e.sort_order, "bundle": e.bundle,
    }


async def _outcome_to_item(db: AsyncSession, format_slug: str, outcome: roll_engine.RollOutcome) -> RollResultItem:
    item = RollResultItem(
        column_name=outcome.column_name,
        dice=[RolledDieOut(sides=d.sides, result=d.result) for d in outcome.dice],
        total=outcome.total,
        entry_id=uuid.UUID(outcome.entry_id) if outcome.entry_id else None,
        kind=outcome.kind,
        text=outcome.text,
        resolved_text=outcome.resolved_text,
        ref_id=uuid.UUID(outcome.ref_id) if outcome.ref_id else None,
        extra=outcome.extra,
    )
    if item.entry_id:
        item.tag_ids = list((await db.execute(
            select(TableEntryTag.tag_id).where(TableEntryTag.entry_id == item.entry_id)
        )).scalars().all())
    if item.ref_id and item.kind != "table_ref":
        item.ref_hydrated = await _hydrate_ref(db, item.kind, item.ref_id)
    return item


async def _outcome_to_result(db: AsyncSession, table: RandomTable, format_slug: str, outcomes: list[roll_engine.RollOutcome]) -> RollResult:
    items = [await _outcome_to_item(db, format_slug, o) for o in outcomes]
    return RollResult(table_id=table.id, table_name=table.name, format_slug=format_slug, items=items)


@router.post("/{table_id}/roll", response_model=RollResult)
async def roll_random_table(table_id: uuid.UUID, payload: RollRequest = RollRequest(), db: AsyncSession = Depends(get_db)):
    table = await get_or_404(db, RandomTable, table_id)
    return await _roll_table(db, table, payload)
