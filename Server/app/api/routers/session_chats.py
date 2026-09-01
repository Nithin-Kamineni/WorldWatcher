import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_sort, create_kwargs, get_or_404, paginate
from app.core.database import get_db
from app.models import SessionChat
from app.schemas.session_chat import SessionChatCreate, SessionChatRead, SessionChatUpdate
from app.schemas.common import Page, PageMeta

router = APIRouter(prefix="/session-chats", tags=["session-chats"])


@router.get("", response_model=Page[SessionChatRead])
async def list_session_chats(
    page: PaginationDep,
    campaign_id: Optional[uuid.UUID] = None,
    note_id: Optional[uuid.UUID] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(SessionChat)
    if campaign_id is not None:
        base = base.where(SessionChat.campaign_id == campaign_id)
    if note_id is not None:
        base = base.where(SessionChat.note_id == note_id)
    sorted_stmt = apply_sort(base, SessionChat, sort, "updated_at", default_desc=True)
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{session_chat_id}", response_model=SessionChatRead)
async def get_session_chat(session_chat_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, SessionChat, session_chat_id)


@router.post("", response_model=SessionChatRead, status_code=201)
async def create_session_chat(payload: SessionChatCreate, db: AsyncSession = Depends(get_db)):
    obj = SessionChat(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{session_chat_id}", response_model=SessionChatRead)
async def update_session_chat(session_chat_id: uuid.UUID, payload: SessionChatUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, SessionChat, session_chat_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{session_chat_id}", status_code=204)
async def delete_session_chat(session_chat_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, SessionChat, session_chat_id)
    await db.delete(obj)
    await db.commit()
