import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils import (
    PaginationDep,
    apply_campaign_scope,
    apply_in_list,
    apply_search,
    apply_sort,
    create_kwargs,
    get_or_404,
    paginate,
)
from app.core.database import get_db
from app.models import Bastion, BastionFacility, BastionFacilityInstance
from app.schemas.bastions import (
    BastionCreate,
    BastionDetail,
    BastionFacilityCreate,
    BastionFacilityDetail,
    BastionFacilityInstanceCreate,
    BastionFacilityInstanceRead,
    BastionFacilityInstanceUpdate,
    BastionFacilityRead,
    BastionFacilityUpdate,
    BastionRead,
    BastionUpdate,
)
from app.schemas.common import Page, PageMeta

facilities_router = APIRouter(prefix="/bastion-facilities", tags=["bastions"])


@facilities_router.get("", response_model=Page[BastionFacilityRead])
async def list_bastion_facilities(
    page: PaginationDep,
    q: Optional[str] = None,
    facility_type: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(BastionFacility)
    base = apply_in_list(base, BastionFacility, "facility_type", facility_type)
    base = apply_search(base, BastionFacility, ["name"], q)
    sorted_stmt = apply_sort(base, BastionFacility, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@facilities_router.get("/{facility_id}", response_model=BastionFacilityDetail)
async def get_bastion_facility(facility_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, BastionFacility, facility_id)


@facilities_router.post("", response_model=BastionFacilityRead, status_code=201)
async def create_bastion_facility(payload: BastionFacilityCreate, db: AsyncSession = Depends(get_db)):
    obj = BastionFacility(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@facilities_router.patch("/{facility_id}", response_model=BastionFacilityRead)
async def update_bastion_facility(
    facility_id: uuid.UUID, payload: BastionFacilityUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await get_or_404(db, BastionFacility, facility_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@facilities_router.delete("/{facility_id}", status_code=204)
async def delete_bastion_facility(facility_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, BastionFacility, facility_id)
    await db.delete(obj)
    await db.commit()


router = APIRouter(prefix="/bastions", tags=["bastions"])


@router.get("", response_model=Page[BastionRead])
async def list_bastions(
    page: PaginationDep,
    q: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
    scope: str = "own",
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    base = select(Bastion)
    base = apply_campaign_scope(base, Bastion, campaign_id, scope)
    base = apply_search(base, Bastion, ["name"], q)
    sorted_stmt = apply_sort(base, Bastion, sort, "name")
    items, meta = await paginate(db, base, sorted_stmt, page)
    return Page(items=items, meta=PageMeta(**meta))


@router.get("/{bastion_id}", response_model=BastionDetail)
async def get_bastion(bastion_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Bastion, bastion_id)
    facilities = (
        await db.execute(
            select(BastionFacilityInstance)
            .where(BastionFacilityInstance.bastion_id == bastion_id)
            .order_by(BastionFacilityInstance.sort_order)
        )
    ).scalars().all()
    detail = BastionDetail.model_validate(obj)
    detail.facilities = [BastionFacilityInstanceRead.model_validate(f) for f in facilities]
    return detail


@router.post("", response_model=BastionRead, status_code=201)
async def create_bastion(payload: BastionCreate, db: AsyncSession = Depends(get_db)):
    obj = Bastion(**create_kwargs(payload))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{bastion_id}", response_model=BastionRead)
async def update_bastion(bastion_id: uuid.UUID, payload: BastionUpdate, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Bastion, bastion_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{bastion_id}", status_code=204)
async def delete_bastion(bastion_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, Bastion, bastion_id)
    await db.delete(obj)
    await db.commit()


# ---- Nested: bastion facility instances ----


@router.get("/{bastion_id}/facilities", response_model=list[BastionFacilityInstanceRead])
async def list_bastion_facility_instances(bastion_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await get_or_404(db, Bastion, bastion_id)
    rows = (
        await db.execute(
            select(BastionFacilityInstance)
            .where(BastionFacilityInstance.bastion_id == bastion_id)
            .order_by(BastionFacilityInstance.sort_order)
        )
    ).scalars().all()
    return rows


@router.post("/{bastion_id}/facilities", response_model=BastionFacilityInstanceRead, status_code=201)
async def add_bastion_facility_instance(
    bastion_id: uuid.UUID, payload: BastionFacilityInstanceCreate, db: AsyncSession = Depends(get_db)
):
    await get_or_404(db, Bastion, bastion_id)
    data = create_kwargs(payload)
    data["bastion_id"] = bastion_id
    obj = BastionFacilityInstance(**data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/facilities/{instance_id}", response_model=BastionFacilityInstanceRead)
async def update_bastion_facility_instance(
    instance_id: uuid.UUID, payload: BastionFacilityInstanceUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await get_or_404(db, BastionFacilityInstance, instance_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/facilities/{instance_id}", status_code=204)
async def remove_bastion_facility_instance(instance_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await get_or_404(db, BastionFacilityInstance, instance_id)
    await db.delete(obj)
    await db.commit()
