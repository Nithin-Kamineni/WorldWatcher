import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, create_kwargs, get_or_404, paginate
from app.core.database import get_db
from app.models import Article, ArticleFolder
from app.schemas.article import (
    ArticleCreate,
    ArticleFolderCreate,
    ArticleFolderRead,
    ArticleFolderUpdate,
    ArticleRead,
    ArticleUpdate,
)
from app.schemas.common import Page, PageMeta

router = APIRouter(prefix="/articles", tags=["articles"])
folders_router = APIRouter(prefix="/article-folders", tags=["articles"])


@router.get("", response_model=Page[ArticleRead])
async def list_articles(
    page: PaginationDep,
    world_id: Optional[uuid.UUID] = None,
    q: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Article)
    if world_id is not None:
        base = base.where(Article.world_id == world_id)
    base = apply_search(base, Article, ["name"], q)
    sorted_stmt = apply_sort(base, Article, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{article_id}", response_model=ArticleRead)
async def get_article(article_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Article, article_id)


@router.post("", response_model=ArticleRead, status_code=201)
async def create_article(payload: ArticleCreate, db: AsyncSession = Depends(get_db)):
    obj = Article(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{article_id}", response_model=ArticleRead)
async def update_article(article_id: uuid.UUID, payload: ArticleUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Article, article_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{article_id}", status_code=204)
async def delete_article(article_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Article, article_id)
    await db.delete(obj)
    await db.commit()


@folders_router.get("", response_model=Page[ArticleFolderRead])
async def list_article_folders(
    page: PaginationDep,
    world_id: Optional[uuid.UUID] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(ArticleFolder)
    if world_id is not None:
        base = base.where(ArticleFolder.world_id == world_id)
    sorted_stmt = apply_sort(base, ArticleFolder, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@folders_router.get("/{folder_id}", response_model=ArticleFolderRead)
async def get_article_folder(folder_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, ArticleFolder, folder_id)


@folders_router.post("", response_model=ArticleFolderRead, status_code=201)
async def create_article_folder(payload: ArticleFolderCreate, db: AsyncSession = Depends(get_db)):
    obj = ArticleFolder(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@folders_router.patch("/{folder_id}", response_model=ArticleFolderRead)
async def update_article_folder(folder_id: uuid.UUID, payload: ArticleFolderUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, ArticleFolder, folder_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@folders_router.delete("/{folder_id}", status_code=204)
async def delete_article_folder(folder_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, ArticleFolder, folder_id)
    await db.delete(obj)
    await db.commit()
