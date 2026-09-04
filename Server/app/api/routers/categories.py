"""Task 2: the self-referential category browse tree. Users may add child
nodes anywhere; is_system nodes are curated and not user-deletable."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import create_kwargs, get_or_404
from app.core.database import get_db
from app.models import Category
from app.schemas.random_tables import CategoryCreate, CategoryNode, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


def _build_tree(rows: list[Category], root_id: Optional[uuid.UUID] = None) -> list[CategoryNode]:
    by_parent: dict[Optional[uuid.UUID], list[Category]] = {}
    for row in rows:
        by_parent.setdefault(row.parent_id, []).append(row)
    for children in by_parent.values():
        children.sort(key=lambda r: (r.sort_order, r.name))

    def _node(row: Category) -> CategoryNode:
        node = CategoryNode.model_validate(row)
        node.children = [_node(c) for c in by_parent.get(row.id, [])]
        return node

    return [_node(r) for r in by_parent.get(root_id, [])]


@router.get("", response_model=list[CategoryRead])
async def list_categories(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Category).order_by(Category.sort_order, Category.name))).scalars().all()
    return rows


@router.get("/tree", response_model=list[CategoryNode])
async def get_category_tree(db: AsyncSession = Depends(get_db)):
    """Task 2.1.3 - the whole tree, via a recursive CTE (kept close to a plain
    flat SELECT since a CTE with no filter is equivalent to it, but written
    as WITH RECURSIVE so the query plan/shape matches the subtree endpoint
    below and stays correct if a future filter is added here)."""
    result = await db.execute(
        text(
            """
            WITH RECURSIVE tree AS (
                SELECT id, slug, name, parent_id, is_system, icon, sort_order, created_at
                FROM category WHERE parent_id IS NULL
                UNION ALL
                SELECT c.id, c.slug, c.name, c.parent_id, c.is_system, c.icon, c.sort_order, c.created_at
                FROM category c JOIN tree t ON c.parent_id = t.id
            )
            SELECT * FROM tree
            """
        )
    )
    rows = [Category(**dict(r._mapping)) for r in result]
    return _build_tree(rows, None)


@router.get("/{category_id}/subtree", response_model=CategoryNode)
async def get_category_subtree(category_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    root = await get_or_404(db, Category, category_id)
    result = await db.execute(
        text(
            """
            WITH RECURSIVE tree AS (
                SELECT id, slug, name, parent_id, is_system, icon, sort_order, created_at
                FROM category WHERE id = :root_id
                UNION ALL
                SELECT c.id, c.slug, c.name, c.parent_id, c.is_system, c.icon, c.sort_order, c.created_at
                FROM category c JOIN tree t ON c.parent_id = t.id
            )
            SELECT * FROM tree
            """
        ),
        {"root_id": category_id},
    )
    rows = [Category(**dict(r._mapping)) for r in result]
    by_id = {r.id: r for r in rows}
    node = CategoryNode.model_validate(root)
    children_rows = [r for r in rows if r.id != category_id]
    node.children = _build_tree(children_rows, category_id)
    return node


@router.post("", response_model=CategoryRead, status_code=201)
async def create_category(payload: CategoryCreate, db: AsyncSession = Depends(get_db)):
    obj = Category(**create_kwargs(payload), is_system=False)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(category_id: uuid.UUID, payload: CategoryUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Category, category_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{category_id}", status_code=204)
async def delete_category(category_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Category, category_id)
    if obj.is_system:
        raise HTTPException(status_code=403, detail="System categories cannot be deleted")
    await db.delete(obj)
    await db.commit()
