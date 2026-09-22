"""Task 6: composite generators - several random_tables mapped into named
slots, fixed or tag-filtered by an input parameter."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_campaign_scope, apply_search, apply_sort, get_or_404, paginate
from app.core.database import get_db
from app.models import Generator, GeneratorComponent, GeneratorTag, RandomTable, TableColumn, TableEntry, TableEntryTag
from app.schemas.common import Page, PageMeta
from app.schemas.random_tables import (
    GeneratorComponentRead,
    GeneratorComponentsWrite,
    GeneratorCreate,
    GeneratorDetail,
    GeneratorRead,
    GeneratorRollRequest,
    GeneratorRollResult,
    GeneratorRollSlotResult,
    GeneratorUpdate,
    RollResultItem,
)
from app.services import roll_engine

router = APIRouter(prefix="/generators", tags=["generators"])


async def _load_detail(db: AsyncSession, gen: Generator) -> GeneratorDetail:
    components = (
        await db.execute(select(GeneratorComponent).where(GeneratorComponent.generator_id == gen.id).order_by(GeneratorComponent.sort_order))
    ).scalars().all()
    detail = GeneratorDetail.model_validate(gen)
    detail.tag_ids = (await db.execute(select(GeneratorTag.tag_id).where(GeneratorTag.generator_id == gen.id))).scalars().all()
    detail.components = [GeneratorComponentRead.model_validate(c) for c in components]
    return detail


async def _replace_components(db: AsyncSession, gen: Generator, components) -> None:
    existing = (await db.execute(select(GeneratorComponent).where(GeneratorComponent.generator_id == gen.id))).scalars().all()
    for row in existing:
        await db.delete(row)
    await db.flush()
    for i, c in enumerate(components):
        db.add(
            GeneratorComponent(
                generator_id=gen.id,
                table_id=c.table_id,
                output_slot=c.output_slot,
                filter_param_key=c.filter_param_key,
                roll_count=c.roll_count,
                optional=c.optional,
                sort_order=c.sort_order or i,
            )
        )


@router.get("", response_model=Page[GeneratorRead])
async def list_generators(
    page: PaginationDep,
    q: Optional[str] = None,
    category_id: Optional[uuid.UUID] = None,
    campaign_id: Optional[uuid.UUID] = None,
    scope: str = "own_or_global",
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Generator)
    base = apply_campaign_scope(base, Generator, campaign_id, scope)
    if category_id:
        base = base.where(Generator.category_id == category_id)
    base = apply_search(base, Generator, ["name", "description"], q)
    sorted_stmt = apply_sort(base, Generator, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    reads = []
    for item in items:
        r = GeneratorRead.model_validate(item)
        r.tag_ids = (await db.execute(select(GeneratorTag.tag_id).where(GeneratorTag.generator_id == item.id))).scalars().all()
        reads.append(r)
    return Page(items=reads, meta=PageMeta(**meta))


@router.get("/{generator_id}", response_model=GeneratorDetail)
async def get_generator(generator_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Generator, generator_id)
    return await _load_detail(db, obj)


@router.post("", response_model=GeneratorDetail, status_code=201)
async def create_generator(payload: GeneratorCreate, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(Generator).where(Generator.slug == payload.slug))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Generator slug '{payload.slug}' already exists")
    data = payload.model_dump(exclude={"components", "tag_ids", "parameters"})
    if not data.get("id"):
        data.pop("id", None)
    obj = Generator(**data, parameters=[p.model_dump() for p in payload.parameters])
    db.add(obj)
    await db.flush()
    await _replace_components(db, obj, payload.components)
    for tag_id in payload.tag_ids:
        db.add(GeneratorTag(generator_id=obj.id, tag_id=tag_id))
    await db.commit()
    await db.refresh(obj)
    return await _load_detail(db, obj)


@router.patch("/{generator_id}", response_model=GeneratorDetail)
async def update_generator(generator_id: uuid.UUID, payload: GeneratorUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Generator, generator_id)
    if obj.is_system:
        raise HTTPException(status_code=403, detail="System generators can't be edited directly")
    data = payload.model_dump(exclude_unset=True)
    if "parameters" in data and data["parameters"] is not None:
        data["parameters"] = [p if isinstance(p, dict) else p.model_dump() for p in data["parameters"]]
    for key, value in data.items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return await _load_detail(db, obj)


@router.put("/{generator_id}/components", response_model=GeneratorDetail)
async def replace_generator_components(generator_id: uuid.UUID, payload: GeneratorComponentsWrite, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Generator, generator_id)
    await _replace_components(db, obj, payload.components)
    await db.commit()
    await db.refresh(obj)
    return await _load_detail(db, obj)


@router.post("/{generator_id}/clone", response_model=GeneratorDetail, status_code=201)
async def clone_generator(generator_id: uuid.UUID, campaign_id: Optional[uuid.UUID] = None, db: AsyncSession = Depends(get_db)):
    """Task 11.4: the escape hatch that makes the is_system read-only rule liveable.
    PATCH and DELETE above refuse to touch a curated generator; this forks it into an
    editable copy the DM owns, mirroring clone_random_table."""
    source = await get_or_404(db, Generator, generator_id)
    detail = await _load_detail(db, source)
    clone = Generator(
        campaign_id=campaign_id,
        # slug is UNIQUE, so it can't be copied verbatim. The uuid4 tail keeps repeated
        # clones of the same source from colliding with each other either.
        slug=f"{source.slug}-copy-{uuid.uuid4().hex[:8]}",
        name=f"{source.name} (copy)",
        category_id=source.category_id,
        description=source.description,
        combine_template=source.combine_template,
        parameters=source.parameters,
        is_system=False,
    )
    db.add(clone)
    await db.flush()
    # Components point AT tables rather than owning them, so the clone shares the source's
    # component tables - forking a generator must not fork the whole table library with it.
    await _replace_components(db, clone, detail.components)
    for tag_id in detail.tag_ids:
        db.add(GeneratorTag(generator_id=clone.id, tag_id=tag_id))
    await db.commit()
    await db.refresh(clone)
    return await _load_detail(db, clone)


@router.delete("/{generator_id}", status_code=204)
async def delete_generator(generator_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Generator, generator_id)
    if obj.is_system:
        raise HTTPException(status_code=403, detail="System generators can't be deleted")
    await db.delete(obj)
    await db.commit()


@router.post("/{generator_id}/roll", response_model=GeneratorRollResult)
async def roll_generator(generator_id: uuid.UUID, payload: GeneratorRollRequest = GeneratorRollRequest(), db: AsyncSession = Depends(get_db)):
    """Task 6.3: roll each component's table, filtering a constrained slot's
    eligible entries by tag intersection with the passed parameter value
    BEFORE rolling; drop optional components whose filter yields nothing;
    fill combine_template by output_slot."""
    gen = await get_or_404(db, Generator, generator_id)
    components = (
        await db.execute(select(GeneratorComponent).where(GeneratorComponent.generator_id == generator_id).order_by(GeneratorComponent.sort_order))
    ).scalars().all()

    slots: list[GeneratorRollSlotResult] = []
    fill: dict[str, str] = {}

    for comp in components:
        table = await db.get(RandomTable, comp.table_id)
        if table is None:
            continue
        columns = (await db.execute(select(TableColumn).where(TableColumn.table_id == table.id).order_by(TableColumn.sort_order))).scalars().all()
        if not columns:
            continue
        column = columns[0]
        entries = (await db.execute(select(TableEntry).where(TableEntry.column_id == column.id))).scalars().all()

        eligible = entries
        if comp.filter_param_key:
            param_value = payload.params.get(comp.filter_param_key)
            if param_value:
                # Resolve "namespace:value" -> tag id, then find entries carrying it.
                from app.models import Tag

                ns, _, val = param_value.partition(":")
                tag_row = (await db.execute(select(Tag).where(Tag.namespace == ns, Tag.value == val))).scalar_one_or_none()
                if tag_row:
                    tagged_entry_ids = set(
                        (await db.execute(select(TableEntryTag.entry_id).where(TableEntryTag.tag_id == tag_row.id))).scalars().all()
                    )
                    eligible = [e for e in entries if e.id in tagged_entry_ids]
                else:
                    eligible = []
            if not eligible:
                if comp.optional:
                    slots.append(GeneratorRollSlotResult(slot=comp.output_slot, table_id=table.id, table_name=table.name, skipped=True))
                    continue
                eligible = entries  # required slot with no matching tag - fall back to unfiltered rather than producing nothing

        if not eligible:
            slots.append(GeneratorRollSlotResult(slot=comp.output_slot, table_id=table.id, table_name=table.name, skipped=True))
            continue

        entry_dicts = [
            {
                "id": e.id, "min": e.min, "max": e.max, "weight": e.weight, "kind": e.kind, "text": e.text,
                "encounter_id": e.encounter_id, "target_table_id": e.target_table_id, "creature_id": e.creature_id,
                "npc_id": e.npc_id, "item_id": e.item_id, "sort_order": e.sort_order,
            }
            for e in eligible
        ]
        outcome = roll_engine.pick_lookup(entry_dicts, roll_engine.DieSpec(1, len(entry_dicts) or 1), column.name)
        result_item = RollResultItem(
            column_name=column.name,
            entry_id=uuid.UUID(outcome.entry_id) if outcome.entry_id else None,
            kind=outcome.kind,
            text=outcome.text,
            resolved_text=outcome.resolved_text,
        )
        slots.append(GeneratorRollSlotResult(slot=comp.output_slot, table_id=table.id, table_name=table.name, result=result_item))
        fill[comp.output_slot] = outcome.resolved_text or outcome.text or ""

    try:
        combined_text = gen.combine_template.format(**fill)
    except (KeyError, IndexError):
        combined_text = gen.combine_template

    return GeneratorRollResult(generator_id=gen.id, slots=slots, combined_text=combined_text)
