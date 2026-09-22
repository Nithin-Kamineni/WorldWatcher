"""Records what changed on a piece of world content, and prunes the record.

Called from the three routers that own world content the World Manager lists (articles,
creatures/NPCs, factions). Everything here is opt-in per call site rather than an ORM
event hook: a hook would also fire for the importer seeding ten thousand compendium
creatures, and "history" that is mostly the seed script is not history.

THE SHAPE OF A RECORDED CHANGE. `before_state` is a full column snapshot and is the only
thing Restore reads. `changes` is display data - one entry per field that actually moved,
with long text reduced to a preview - and is the only thing the timeline reads. They are
written together and never have to agree about anything except which fields changed.

WHY DIFF BY VALUE AND NOT BY WHICH KEYS WERE SENT. The client PATCHes a full payload on
every save (see useArticleStore/useFactionStore/useCreatureStore - all three build the
whole object and send it), so `exclude_unset` says "all of them" on every request.
Diffing values is also what makes a save that changed nothing record nothing, which is
what keeps the timeline readable.
"""
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect as sa_inspect

from app.models import Article, Campaign, Creature, EntityRevision, Faction

log = logging.getLogger(__name__)

# ---------------------------------------------------------------- retention

#: Keep everything from the last six hours, however much of it there is...
RETENTION_WINDOW = timedelta(hours=6)
#: ...and the newest 500 changes however old they are. A row has to fall outside BOTH to
#: be dropped, which is the "whichever is larger" this was asked for: a quiet week still
#: leaves 500 undoable changes, and a frantic prep session leaves all of them.
RETENTION_MIN_ROWS = 500
#: Pruning is a scan, so it does not run on every write - only once a world has drifted
#: this far past the floor. Costs at most this many extra rows, saves a DELETE per edit.
PRUNE_SLACK = 100

# ---------------------------------------------------------------- field naming

#: Columns that say nothing about the edit: surrogate keys, and timestamps that move on
#: every write by definition. `slug` is derived from `name`, so it only ever restates it.
IGNORED_FIELDS = {"id", "created_at", "updated_at", "slug"}

#: Labels for the columns whose snake_case does not humanise into anything a DM would
#: recognise. Everything else falls through to `_humanize`.
FIELD_LABELS = {
    "field_values": "Fields",
    "cover_image_asset_id": "Cover image",
    "image_asset_id": "Image",
    "portrait_asset_id": "Portrait",
    "token_asset_id": "Token image",
    "folder_id": "Folder",
    "faction_type": "Faction type",
    "power_label": "Power label",
    "location_summary": "Location",
    "creature_type": "Creature type",
    "creature_subtype": "Creature subtype",
    "challenge_rating": "Challenge rating",
    "challenge_rating_display": "CR",
    "hit_points": "Hit points",
    "hit_dice": "Hit dice",
    "armor_class": "Armour class",
    "passive_perception": "Passive perception",
    "proficiency_bonus": "Proficiency bonus",
    "character_class": "Class",
    "linked_entity_type": "Linked entity type",
    "linked_entity_id": "Linked entity",
    "campaign_id": "Campaign",
    "world_id": "World",
    "source_id": "Source",
}

#: Past this many characters a field is prose, not a value: the timeline reports how much
#: of it moved instead of trying to show both versions on one line.
LONG_TEXT_THRESHOLD = 120
#: How much of a value the stored preview keeps. The full text is in `before_state`.
PREVIEW_CHARS = 240

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
#: Splits camelCase, which is what the keys inside `field_values` are - those come from
#: the client's ARTICLE_TEMPLATES (`titleOrAliases`, `notableMembers`, `homePlane`), not
#: from a column, so snake_case handling alone would render them "Notablemembers".
_CAMEL_RE = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")


def _humanize(field: str) -> str:
    """Sentence case, not title case: "Notable members", "Title or aliases". Title case
    would read as a heading in a list that is already full of headings."""
    known = FIELD_LABELS.get(field)
    if known:
        return known
    words = _CAMEL_RE.sub(" ", field.replace("_", " ")).split()
    if not words:
        return field
    head, *rest = words
    return " ".join([head.capitalize()] + [w.lower() for w in rest])


# ---------------------------------------------------------------- snapshotting


def _jsonable(value: Any) -> Any:
    """Column values as JSON, with the types SQLAlchemy hands back that json cannot take:
    UUIDs (every id and FK here), datetimes, and Numeric's Decimal."""
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    return value


def snapshot(obj: Any) -> dict[str, Any]:
    """Every mapped column of a loaded row, as JSON. Taken BEFORE the patch is applied -
    once `setattr` has run there is no way back to the old values short of a reload."""
    return {c.key: _jsonable(getattr(obj, c.key)) for c in sa_inspect(type(obj)).mapper.column_attrs}


def coerce_state(model: type, state: dict[str, Any]) -> dict[str, Any]:
    """The inverse of `snapshot`, for writing a stored snapshot back onto a row.

    Two things have to happen and both are about the round trip through JSON. Ids came
    back as strings and have to be UUIDs again or asyncpg rejects the bind; and a snapshot
    taken before a column existed (or after one was dropped) carries keys this model no
    longer has, which would raise on `setattr`. Unknown keys are dropped rather than
    refused - a six-month-old snapshot restoring everything it still recognises is far
    more useful than one that refuses to restore at all."""
    columns = {c.key: c for c in sa_inspect(model).mapper.column_attrs}
    coerced: dict[str, Any] = {}
    for key, value in state.items():
        attr = columns.get(key)
        if attr is None or key in ("created_at", "updated_at"):
            continue
        python_type = None
        try:
            python_type = attr.columns[0].type.python_type
        except (NotImplementedError, AttributeError):
            # JSONB and friends have no single python type; they round-trip as-is.
            pass
        if value is not None and python_type is uuid.UUID and isinstance(value, str):
            value = uuid.UUID(value)
        elif value is not None and python_type is datetime and isinstance(value, str):
            value = datetime.fromisoformat(value)
        coerced[key] = value
    return coerced


# ---------------------------------------------------------------- diffing


def _text_preview(text: str) -> str:
    """Body and description fields are TipTap HTML. Left as markup, a one-line preview is
    mostly tags and style attributes, so they come out for display - the markup itself is
    intact in `before_state`, which is the copy Restore reads."""
    plain = _WS_RE.sub(" ", _TAG_RE.sub(" ", text)).strip()
    return plain[:PREVIEW_CHARS] + ("…" if len(plain) > PREVIEW_CHARS else "")


def _preview(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, str):
        return _text_preview(value)
    if isinstance(value, (list, tuple)):
        joined = ", ".join(p for p in (_preview(v) for v in value) if p)
        return joined[:PREVIEW_CHARS] + ("…" if len(joined) > PREVIEW_CHARS else "")
    if isinstance(value, dict):
        joined = ", ".join(f"{_humanize(k)}: {_preview(v)}" for k, v in value.items())
        return joined[:PREVIEW_CHARS] + ("…" if len(joined) > PREVIEW_CHARS else "")
    return str(value)


def _plain_length(value: Any) -> int:
    return len(_WS_RE.sub(" ", _TAG_RE.sub(" ", value)).strip()) if isinstance(value, str) else 0


def _change_entry(field: str, label: str, before: Any, after: Any) -> dict[str, Any]:
    """One row of the expandable diff. `kind` is what the UI switches its layout on:
    'long' gets a character delta instead of a before/after pair, 'list' gets counts."""
    if isinstance(before, (list, tuple)) or isinstance(after, (list, tuple)):
        kind = "list"
    elif isinstance(before, str) or isinstance(after, str):
        kind = "long" if max(_plain_length(before), _plain_length(after)) > LONG_TEXT_THRESHOLD else "text"
    else:
        kind = "value"

    entry: dict[str, Any] = {
        "field": field,
        "label": label,
        "kind": kind,
        "before": _preview(before),
        "after": _preview(after),
    }
    if kind == "long":
        entry["delta"] = _plain_length(after) - _plain_length(before)
    if kind == "list":
        entry["before_count"] = len(before) if isinstance(before, (list, tuple)) else 0
        entry["after_count"] = len(after) if isinstance(after, (list, tuple)) else 0
    return entry


def diff(before: dict[str, Any], after: dict[str, Any]) -> list[dict[str, Any]]:
    """Field-level changes between two snapshots.

    `field_values` is expanded one level rather than reported whole: on an article that
    JSONB bag holds most of the actual content (a Settlement's Population, Ruler,
    Defences), so collapsing it to "Fields changed" would throw away the only interesting
    part of almost every article edit."""
    changes: list[dict[str, Any]] = []
    for field in sorted(set(before) | set(after)):
        if field in IGNORED_FIELDS:
            continue
        old, new = before.get(field), after.get(field)
        if old == new:
            continue

        if field == "field_values" and isinstance(old, dict) and isinstance(new, dict):
            for key in sorted(set(old) | set(new)):
                if old.get(key) != new.get(key):
                    changes.append(
                        _change_entry(f"field_values.{key}", _humanize(key), old.get(key), new.get(key))
                    )
            continue

        changes.append(_change_entry(field, _humanize(field), old, new))
    return changes


# ---------------------------------------------------------------- summarising

#: The summary is one line under a title in a list, so a quoted value in it gets far less
#: room than the same value gets in the expanded diff.
SUMMARY_VALUE_CHARS = 42
_ELLIPSIS = "…"
_ARROW = "→"
_LQUO = "“"
_RQUO = "”"


def _clip(text: str) -> str:
    return text[:SUMMARY_VALUE_CHARS] + (_ELLIPSIS if len(text) > SUMMARY_VALUE_CHARS else "")


def _quoted(text: str) -> str:
    return f"{_LQUO}{_clip(text)}{_RQUO}"


def summarize(action: str, changes: list[dict[str, Any]]) -> str:
    """The one-line "how it was edited" the timeline shows under each title."""
    if action == "create":
        return "Created"
    if action == "delete":
        return "Deleted"
    if not changes:
        return "Saved with no changes"

    if len(changes) == 1:
        c = changes[0]
        label, before, after = c["label"], c["before"], c["after"]
        if c["kind"] == "long":
            delta = c.get("delta", 0)
            if delta > 0:
                return f"{label} edited (+{delta:,} characters)"
            if delta < 0:
                return f"{label} edited ({delta:,} characters)"
            return f"{label} rewritten"
        if c["kind"] == "list":
            return f"{label}: {c['before_count']} {_ARROW} {c['after_count']} items"
        if not before:
            return f"{label} set to {_quoted(after)}"
        if not after:
            return f"{label} cleared"
        return f"{label}: {_quoted(before)} {_ARROW} {_quoted(after)}"

    labels = [c["label"] for c in changes]
    head = ", ".join(labels[:3])
    rest = len(labels) - 3
    return f"{head} and {rest} more changed" if rest > 0 else f"{head} changed"


# ---------------------------------------------------------------- recording

#: Which `entity_type` each tracked model records under. Creatures split in two because
#: the World Manager treats an NPC and a homebrew monster as different kinds of content
#: even though they share a table - see `_entity_type`.
_TRACKED = {Article: "article", Faction: "faction", Creature: "creature"}

#: Actions whose revision is only worth writing when a field actually moved.
_DIFFED_ACTIONS = ("update", "restore")


def _entity_type(obj: Any) -> Optional[str]:
    if isinstance(obj, Creature):
        return "npc" if getattr(obj, "category", None) == "npc" else "creature"
    return _TRACKED.get(type(obj))


async def _world_id_for(db: AsyncSession, obj: Any) -> Optional[uuid.UUID]:
    """Articles carry their world. Factions and creatures carry a campaign, and a creature
    may carry nothing at all - the global compendium library is shared reference data, not
    one world's content, so it is not tracked."""
    if isinstance(obj, Article):
        return obj.world_id
    campaign_id = getattr(obj, "campaign_id", None)
    if campaign_id is None:
        return None
    return (await db.execute(select(Campaign.world_id).where(Campaign.id == campaign_id))).scalar_one_or_none()


async def record(
    db: AsyncSession,
    obj: Any,
    *,
    action: str,
    before: Optional[dict[str, Any]] = None,
    summary: Optional[str] = None,
) -> Optional[uuid.UUID]:
    """Adds a revision row to the open transaction and returns the world it belongs to,
    or None when nothing was recorded.

    The return value is what the caller passes to `prune` after committing - pruning
    inside the same transaction would let a failure there roll back the DM's actual edit.

    The insert is left to the caller's commit, so a recorded change and the change it
    describes land together or not at all. Building it, though, is best-effort: a history
    row is never worth losing a save over, so a failure here is logged and swallowed."""
    try:
        entity_type = _entity_type(obj)
        if entity_type is None:
            return None
        world_id = await _world_id_for(db, obj)
        if world_id is None:
            return None

        after = None if action == "delete" else snapshot(obj)
        changes = diff(before or {}, after or {}) if action in _DIFFED_ACTIONS else []
        # A save that moved nothing is not a change. Creates and deletes are changes even
        # though they have no field-level diff to show.
        if action in _DIFFED_ACTIONS and not changes:
            return None

        db.add(
            EntityRevision(
                world_id=world_id,
                entity_type=entity_type,
                entity_id=obj.id,
                entity_name=getattr(obj, "name", "") or "",
                action=action,
                summary=summary or summarize(action, changes),
                changes=changes,
                before_state=before,
            )
        )
        return world_id
    except Exception:  # noqa: BLE001 - see docstring: history must not break the write
        log.exception("Failed to record a %s revision for %r", action, obj)
        return None


async def prune(db: AsyncSession, world_id: Optional[uuid.UUID]) -> None:
    """Enforces the retention rule, in its own transaction, once the edit is safe.

    Drops only rows that are BOTH older than the window AND outside the newest
    RETENTION_MIN_ROWS for the world. Scoped per world because that is the scope the
    timeline is read at - a busy world must not age out a quiet one's undo history."""
    if world_id is None:
        return
    try:
        total = (
            await db.execute(
                select(func.count()).select_from(EntityRevision).where(EntityRevision.world_id == world_id)
            )
        ).scalar_one()
        if total <= RETENTION_MIN_ROWS + PRUNE_SLACK:
            return

        keep = (
            select(EntityRevision.id)
            .where(EntityRevision.world_id == world_id)
            .order_by(EntityRevision.created_at.desc())
            .limit(RETENTION_MIN_ROWS)
            .scalar_subquery()
        )
        await db.execute(
            delete(EntityRevision).where(
                EntityRevision.world_id == world_id,
                EntityRevision.created_at < datetime.now(timezone.utc) - RETENTION_WINDOW,
                EntityRevision.id.not_in(keep),
            )
        )
        await db.commit()
    except Exception:  # noqa: BLE001 - the edit is already committed; retention can wait
        await db.rollback()
        log.exception("Failed to prune revisions for world %s", world_id)
