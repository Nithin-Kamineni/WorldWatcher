"""Shared query-building helpers used by every resource router.

Pydantic already validates/coerces request bodies (UUIDs, dates, enums)
and FastAPI already validates path/query params, so this module only
covers what's left: pagination, sorting, ILIKE search, and a get-or-404
lookup.
"""
import uuid
from dataclasses import dataclass
from typing import Annotated, Optional, Sequence, Type, TypeVar

from fastapi import Depends, HTTPException, Query
from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

ModelT = TypeVar("ModelT")


@dataclass
class Pagination:
    limit: int
    offset: int


def pagination(
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Pagination:
    return Pagination(limit=limit, offset=offset)


PaginationDep = Annotated[Pagination, Depends(pagination)]


def create_kwargs(payload) -> dict:
    """model_dump() a Create schema, dropping `id` when the client didn't
    supply one so the model's own default=uuid.uuid4 applies. Lets the
    frontend assign an id up front (e.g. a dropped map token needs a
    stable id to render before the POST round-trip resolves) while still
    letting the server generate one when the caller doesn't care."""
    data = payload.model_dump()
    if not data.get("id"):
        data.pop("id", None)
    return data


async def get_or_404(session: AsyncSession, model: Type[ModelT], id_: uuid.UUID) -> ModelT:
    obj = await session.get(model, id_)
    if obj is None:
        raise HTTPException(status_code=404, detail=f"{model.__name__} '{id_}' not found")
    return obj


def apply_search(stmt: Select, model, fields: Sequence[str], term: Optional[str]) -> Select:
    if not term:
        return stmt
    pattern = f"%{term}%"
    conditions = [getattr(model, f).ilike(pattern) for f in fields]
    return stmt.where(or_(*conditions))


def apply_campaign_scope(stmt: Select, model, campaign_id: Optional[uuid.UUID], scope: str) -> Select:
    """Controls how campaign_id filters rows shared between a campaign's own homebrew
    and the global reference library (campaign_id IS NULL - see database_scehma.txt 2.4/2.6/2.7):
      'own'          - exact match only (default; preserves every existing caller's behavior)
      'own_or_global'- this campaign's homebrew PLUS the shared/global library
      'all'          - no campaign filtering at all (every campaign's homebrew plus global)
    """
    if scope == "all":
        return stmt
    if campaign_id is None:
        return stmt
    if scope == "own_or_global":
        return stmt.where(or_(model.campaign_id == campaign_id, model.campaign_id.is_(None)))
    return stmt.where(model.campaign_id == campaign_id)


def apply_in_list(stmt: Select, model, field: str, csv_value: Optional[str]) -> Select:
    """Filters `field IN (...)` from a comma-separated query param, so existing
    single-value callers keep working unchanged while the UI can multi-select."""
    if not csv_value:
        return stmt
    values = [v for v in csv_value.split(",") if v]
    if not values:
        return stmt
    return stmt.where(getattr(model, field).in_(values))


def apply_sort(stmt: Select, model, sort: Optional[str], default_field: str, default_desc: bool = False) -> Select:
    if not sort:
        column = getattr(model, default_field)
        return stmt.order_by(column.desc() if default_desc else column.asc())
    descending = sort.startswith("-")
    field = sort[1:] if descending else sort
    column = getattr(model, field, None)
    if column is None:
        raise HTTPException(status_code=400, detail=f"Cannot sort by unknown field '{field}'")
    return stmt.order_by(column.desc() if descending else column.asc())


async def paginate(session: AsyncSession, base_stmt: Select, sorted_stmt: Select, page: Pagination):
    """base_stmt = filtered but unsorted (used for an accurate COUNT).
    sorted_stmt = the same filters with ORDER BY applied (used for the page)."""
    total = (await session.execute(select(func.count()).select_from(base_stmt.subquery()))).scalar_one()
    items = (await session.execute(sorted_stmt.limit(page.limit).offset(page.offset))).scalars().all()
    meta = {"total": total, "limit": page.limit, "offset": page.offset, "count": len(items)}
    return items, meta
