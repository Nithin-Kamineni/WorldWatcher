import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, create_kwargs, get_or_404, paginate
from app.core.database import get_db
from app.models import TokenLibrary
from app.schemas.common import Page, PageMeta
from app.schemas.maps import TokenLibraryCreate, TokenLibraryRead, TokenLibraryUpdate

router = APIRouter(prefix="/token-library", tags=["token-library"])


@router.get("", response_model=Page[TokenLibraryRead])
async def list_token_library(
    page: PaginationDep,
    q: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
    is_favorite: Optional[bool] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(TokenLibrary)
    if campaign_id:
        base = base.where(TokenLibrary.campaign_id == campaign_id)
    if is_favorite is not None:
        base = base.where(TokenLibrary.is_favorite == is_favorite)
    base = apply_search(base, TokenLibrary, ["name"], q)
    sorted_stmt = apply_sort(base, TokenLibrary, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{token_def_id}", response_model=TokenLibraryRead)
async def get_token_definition(token_def_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, TokenLibrary, token_def_id)


@router.post("", response_model=TokenLibraryRead, status_code=201)
async def create_token_definition(payload: TokenLibraryCreate, db: AsyncSession = Depends(get_db)):
    obj = TokenLibrary(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{token_def_id}", response_model=TokenLibraryRead)
async def update_token_definition(
    token_def_id: uuid.UUID, payload: TokenLibraryUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await get_or_404(db, TokenLibrary, token_def_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{token_def_id}", status_code=204)
async def delete_token_definition(token_def_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, TokenLibrary, token_def_id)
    await db.delete(obj)
    await db.commit()
