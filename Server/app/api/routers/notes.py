import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, create_kwargs, get_or_404, paginate
from app.core.database import get_db
from app.models import Note, NoteFolder
from app.schemas.note import (
    NoteCreate,
    NoteFolderCreate,
    NoteFolderRead,
    NoteFolderUpdate,
    NoteRead,
    NoteUpdate,
)
from app.schemas.common import Page, PageMeta

router = APIRouter(prefix="/notes", tags=["notes"])
folders_router = APIRouter(prefix="/note-folders", tags=["notes"])


@router.get("", response_model=Page[NoteRead])
async def list_notes(
    page: PaginationDep,
    campaign_id: Optional[uuid.UUID] = None,
    q: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Note)
    if campaign_id is not None:
        base = base.where(Note.campaign_id == campaign_id)
    base = apply_search(base, Note, ["name"], q)
    sorted_stmt = apply_sort(base, Note, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{note_id}", response_model=NoteRead)
async def get_note(note_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, Note, note_id)


@router.post("", response_model=NoteRead, status_code=201)
async def create_note(payload: NoteCreate, db: AsyncSession = Depends(get_db)):
    obj = Note(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{note_id}", response_model=NoteRead)
async def update_note(note_id: uuid.UUID, payload: NoteUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Note, note_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Note, note_id)
    await db.delete(obj)
    await db.commit()


@folders_router.get("", response_model=Page[NoteFolderRead])
async def list_note_folders(
    page: PaginationDep,
    campaign_id: Optional[uuid.UUID] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(NoteFolder)
    if campaign_id is not None:
        base = base.where(NoteFolder.campaign_id == campaign_id)
    sorted_stmt = apply_sort(base, NoteFolder, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@folders_router.get("/{folder_id}", response_model=NoteFolderRead)
async def get_note_folder(folder_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, NoteFolder, folder_id)


@folders_router.post("", response_model=NoteFolderRead, status_code=201)
async def create_note_folder(payload: NoteFolderCreate, db: AsyncSession = Depends(get_db)):
    obj = NoteFolder(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@folders_router.patch("/{folder_id}", response_model=NoteFolderRead)
async def update_note_folder(folder_id: uuid.UUID, payload: NoteFolderUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, NoteFolder, folder_id)
    if obj.is_default:
        raise HTTPException(400, "Default folders can't be renamed or deleted")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@folders_router.delete("/{folder_id}", status_code=204)
async def delete_note_folder(folder_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, NoteFolder, folder_id)
    if obj.is_default:
        raise HTTPException(400, "Default folders can't be renamed or deleted")
    await db.delete(obj)
    await db.commit()
