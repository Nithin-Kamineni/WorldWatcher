"""Shared response envelope for every list endpoint."""
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PageMeta(BaseModel):
    total: int
    limit: int
    offset: int
    count: int


class Page(BaseModel, Generic[T]):
    items: list[T]
    meta: PageMeta
