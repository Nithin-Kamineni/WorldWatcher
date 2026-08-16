import hashlib
import mimetypes
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import PaginationDep, apply_search, apply_sort, get_or_404, paginate
from app.core.config import settings
from app.core.database import get_db
from app.models import Asset
from app.schemas.common import Page, PageMeta
from app.schemas.reference import AssetRead, AssetUpdate

router = APIRouter(prefix="/assets", tags=["assets"])


def _with_url(asset: Asset) -> AssetRead:
    data = AssetRead.model_validate(asset)
    data.url = f"/api/assets/{asset.id}/file"
    return data


def _safe_path(storage_path: str) -> str:
    """Resolve storage_path under the assets root, refusing traversal outside it."""
    root = os.path.abspath(settings.assets_dir)
    full = os.path.abspath(os.path.join(root, storage_path))
    if os.path.commonpath([root, full]) != root:
        raise HTTPException(status_code=400, detail="Invalid storage path")
    return full


@router.get("", response_model=Page[AssetRead])
async def list_assets(
    page: PaginationDep,
    q: Optional[str] = None,
    asset_type: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Asset)
    if asset_type:
        base = base.where(Asset.asset_type == asset_type)
    base = apply_search(base, Asset, ["filename"], q)
    sorted_stmt = apply_sort(base, Asset, sort, "created_at", default_desc=True)
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=[_with_url(a) for a in items], meta=PageMeta(**meta))


@router.get("/{asset_id}", response_model=AssetRead)
async def get_asset(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Asset, asset_id)
    return _with_url(obj)


@router.get("/{asset_id}/file")
async def get_asset_file(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Asset, asset_id)
    full_path = _safe_path(obj.storage_path)
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Asset file missing on disk")
    media_type = obj.mime_type or mimetypes.guess_type(full_path)[0] or "application/octet-stream"
    return FileResponse(full_path, media_type=media_type, filename=obj.filename)


@router.post("/upload", response_model=AssetRead, status_code=201)
async def upload_asset(
    file: UploadFile,
    asset_type: str,
    db: AsyncSession = Depends(get_db),
):
    valid_types = {
        "creature_portrait", "creature_token", "item_image", "map", "npc_portrait",
        "faction_image", "location_image", "spell_image", "character_portrait",
        "character_token", "other",
    }
    if asset_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid asset_type '{asset_type}'")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    max_bytes = settings.ww_asset_upload_max_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.ww_asset_upload_max_mb}MB limit")

    sha256 = hashlib.sha256(content).hexdigest()

    existing = (await db.execute(select(Asset).where(Asset.sha256 == sha256))).scalar_one_or_none()
    if existing:
        return _with_url(existing)

    ext = os.path.splitext(file.filename or "")[1] or mimetypes.guess_extension(file.content_type or "") or ""
    relative_dir = os.path.join("uploads", asset_type)
    storage_path = os.path.join(relative_dir, f"{sha256}{ext}")
    full_path = _safe_path(storage_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as fh:
        fh.write(content)

    obj = Asset(
        filename=file.filename or f"{sha256}{ext}",
        storage_path=storage_path.replace(os.sep, "/"),
        asset_type=asset_type,
        mime_type=file.content_type,
        file_size=len(content),
        sha256=sha256,
        source="upload",
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return _with_url(obj)


@router.patch("/{asset_id}", response_model=AssetRead)
async def update_asset(asset_id: uuid.UUID, payload: AssetUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Asset, asset_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return _with_url(obj)


@router.delete("/{asset_id}", status_code=204)
async def delete_asset(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Asset, asset_id)
    await db.delete(obj)
    await db.commit()
