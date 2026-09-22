"""The World Manager's edit history, and the undo behind it.

Reads are one query - "the newest N changes in this world" - which is what the composite
index on (world_id, created_at DESC) exists for. Writes happen in the routers that own
the content (articles, creatures, factions); nothing posts here.
"""
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import get_or_404
from app.core.database import get_db
from app.models import Article, Creature, EntityRevision, Faction
from app.schemas.entity_revision import EntityRevisionRead, RestoreResult, RetentionPolicy, to_read
from app.services import revisions

router = APIRouter(prefix="/entity-revisions", tags=["entity-revisions"])

#: `entity_type` back to the table it names. NPCs and monsters are both creatures - the
#: split exists so the timeline can label them differently, not because they are stored
#: differently.
MODELS: dict[str, type] = {
    "article": Article,
    "faction": Faction,
    "npc": Creature,
    "creature": Creature,
}


@router.get("/policy", response_model=RetentionPolicy)
async def get_retention_policy():
    """The live retention rule, so the UI can state it without keeping its own copy."""
    return RetentionPolicy(
        window_hours=int(revisions.RETENTION_WINDOW.total_seconds() // 3600),
        min_rows=revisions.RETENTION_MIN_ROWS,
    )


@router.get("", response_model=list[EntityRevisionRead])
async def list_entity_revisions(
    world_id: uuid.UUID,
    entity_id: Optional[uuid.UUID] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 300,
    db: AsyncSession = Depends(get_db),
):
    """Newest first. Not paginated the way the entity routers are: this is a timeline read
    top-down and then stopped reading, so a limit is the whole of what a caller needs, and
    the retention rule already bounds how much there can ever be."""
    stmt = select(EntityRevision).where(EntityRevision.world_id == world_id)
    if entity_id is not None:
        stmt = stmt.where(EntityRevision.entity_id == entity_id)
    stmt = stmt.order_by(EntityRevision.created_at.desc()).limit(limit)
    return [to_read(row) for row in (await db.execute(stmt)).scalars().all()]


@router.post("/{revision_id}/restore", response_model=RestoreResult)
async def restore_entity_revision(revision_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Puts the entity back the way it was immediately before this change.

    Restoring is itself a recorded change, which is what makes it undoable in turn: the
    new row's own `before_state` is whatever the restore replaced, so a mis-aimed restore
    is one more click to walk back rather than a dead end.

    An entity that was deleted is recreated at its original id, so every reference to it
    (an article's `linked_entity_id`, an encounter's creature rows, a map token) points at
    a live row again instead of a hole."""
    rev = await get_or_404(db, EntityRevision, revision_id)
    # Read off the revision row ONCE, up front. Both exits below can roll the transaction
    # back, and a rollback expires every loaded instance - touching `rev.entity_name`
    # afterwards would send SQLAlchemy to the database from inside the response-building
    # code, outside the greenlet the async driver runs in, which fails as a 500.
    entity_type, entity_id, entity_name = rev.entity_type, rev.entity_id, rev.entity_name
    before_state = rev.before_state
    target = rev.summary or "an earlier version"

    if not before_state:
        raise HTTPException(
            status_code=400,
            detail="This change created the entry, so there is no earlier version to restore.",
        )
    model = MODELS.get(entity_type)
    if model is None:
        raise HTTPException(status_code=400, detail=f"Cannot restore unknown entity type '{entity_type}'")

    state = revisions.coerce_state(model, before_state)
    obj = await db.get(model, entity_id)
    recreated = obj is None

    if recreated:
        obj = model(**state)
        db.add(obj)
        await db.flush()
        world_id = await revisions.record(
            db, obj, action="create", summary=f"Recreated from the version before: {target}"
        )
    else:
        before = revisions.snapshot(obj)
        for key, value in state.items():
            if key == "id":
                continue
            setattr(obj, key, value)
        # Asked explicitly rather than inferred from `record` returning None, which also
        # means "not world content" - the two must not be reported as the same outcome.
        if not revisions.diff(before, revisions.snapshot(obj)):
            # The entity already looks exactly like the restore target. Not an error, and
            # not worth a history row either.
            await db.rollback()
            return RestoreResult(
                entity_type=entity_type,
                entity_id=entity_id,
                entity_name=entity_name,
                recreated=False,
                revision=None,
            )
        world_id = await revisions.record(
            db, obj, action="restore", before=before, summary=f"Restored to the version before: {target}"
        )

    await db.commit()
    await db.refresh(obj)
    await revisions.prune(db, world_id)

    newest = (
        await db.execute(
            select(EntityRevision)
            .where(EntityRevision.entity_id == obj.id)
            .order_by(EntityRevision.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    return RestoreResult(
        entity_type=entity_type,
        entity_id=obj.id,
        entity_name=getattr(obj, "name", "") or "",
        recreated=recreated,
        revision=to_read(newest) if newest is not None else None,
    )


@router.delete("", status_code=204)
async def clear_entity_revisions(world_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Forgets a world's history. Deliberately all-or-nothing per world: a history you can
    edit row by row is not a history, and the retention rule already handles the only other
    reason to delete any of it."""
    await db.execute(sa_delete(EntityRevision).where(EntityRevision.world_id == world_id))
    await db.commit()
