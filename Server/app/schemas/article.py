import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

ArticleVisibility = Literal["gm", "player", "published"]


class ArticleFolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    world_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    name: str
    created_at: datetime
    updated_at: datetime


class ArticleFolderCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    world_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    name: str


class ArticleFolderUpdate(BaseModel):
    parent_id: Optional[uuid.UUID] = None
    name: Optional[str] = None


class ArticleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    world_id: uuid.UUID
    folder_id: Optional[uuid.UUID] = None
    category: str
    name: str
    cover_image_asset_id: Optional[uuid.UUID] = None
    tags: Optional[Any] = None
    visibility: ArticleVisibility
    field_values: Optional[Any] = None
    body: str
    linked_entity_type: Optional[str] = None
    linked_entity_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


class ArticleCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    world_id: uuid.UUID
    folder_id: Optional[uuid.UUID] = None
    category: str
    name: str
    cover_image_asset_id: Optional[uuid.UUID] = None
    tags: Optional[Any] = None
    visibility: ArticleVisibility = "gm"
    field_values: Optional[Any] = None
    body: str = ""
    linked_entity_type: Optional[str] = None
    linked_entity_id: Optional[uuid.UUID] = None


class ArticleUpdate(BaseModel):
    folder_id: Optional[uuid.UUID] = None
    category: Optional[str] = None
    name: Optional[str] = None
    cover_image_asset_id: Optional[uuid.UUID] = None
    tags: Optional[Any] = None
    visibility: Optional[ArticleVisibility] = None
    field_values: Optional[Any] = None
    body: Optional[str] = None
    linked_entity_type: Optional[str] = None
    linked_entity_id: Optional[uuid.UUID] = None
