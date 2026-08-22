"""NPC-creation randomizer reference banks (Bugs.txt) - small, static, global reference
data seeded once via Database/Maintainance/scripts/import_5etools_names.py. No CRUD here
on purpose: the app UI only reads these to power client-side random picks, it never edits
the banks themselves."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import RandomMotivation, RandomName, RandomPitfall, RandomProfession
from app.schemas.reference import RandomMotivationRead, RandomNameRead, RandomPitfallRead, RandomProfessionRead

router = APIRouter(prefix="/random-bank", tags=["random-bank"])


@router.get("/names", response_model=list[RandomNameRead])
async def list_random_names(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomName))
    return result.scalars().all()


@router.get("/professions", response_model=list[RandomProfessionRead])
async def list_random_professions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomProfession))
    return result.scalars().all()


@router.get("/motivations", response_model=list[RandomMotivationRead])
async def list_random_motivations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomMotivation))
    return result.scalars().all()


@router.get("/pitfalls", response_model=list[RandomPitfallRead])
async def list_random_pitfalls(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomPitfall))
    return result.scalars().all()
