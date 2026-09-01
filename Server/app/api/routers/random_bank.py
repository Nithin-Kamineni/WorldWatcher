"""NPC-creation randomizer reference banks (Bugs.txt) - small, static, global reference
data seeded once via Database/Maintainance/scripts/import_5etools_names.py. No CRUD here
on purpose: the app UI only reads these to power client-side random picks, it never edits
the banks themselves."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import (
    RandomAppearance,
    RandomDungeonQuirk,
    RandomDungeonStateOfRuin,
    RandomMotivation,
    RandomName,
    RandomPersonality,
    RandomPitfall,
    RandomProfession,
    RandomRelationship,
    RandomSecret,
    RandomSettlementCalamity,
    RandomSettlementClaimToFame,
    RandomSettlementDefiningTrait,
    RandomSettlementEconomicSource,
    RandomSettlementLocalLeader,
    RandomSettlementRumorHook,
    RandomShopType,
    RandomTavernNamePart,
)
from app.schemas.reference import (
    RandomAppearanceRead,
    RandomDungeonQuirkRead,
    RandomDungeonStateOfRuinRead,
    RandomMotivationRead,
    RandomNameRead,
    RandomPersonalityRead,
    RandomPitfallRead,
    RandomProfessionRead,
    RandomRelationshipRead,
    RandomSecretRead,
    RandomSettlementCalamityRead,
    RandomSettlementClaimToFameRead,
    RandomSettlementDefiningTraitRead,
    RandomSettlementEconomicSourceRead,
    RandomSettlementLocalLeaderRead,
    RandomSettlementRumorHookRead,
    RandomShopTypeRead,
    RandomTavernNamePartRead,
)

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


@router.get("/appearances", response_model=list[RandomAppearanceRead])
async def list_random_appearances(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomAppearance))
    return result.scalars().all()


@router.get("/secrets", response_model=list[RandomSecretRead])
async def list_random_secrets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomSecret))
    return result.scalars().all()


@router.get("/personalities", response_model=list[RandomPersonalityRead])
async def list_random_personalities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomPersonality))
    return result.scalars().all()


@router.get("/relationships", response_model=list[RandomRelationshipRead])
async def list_random_relationships(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomRelationship))
    return result.scalars().all()


@router.get("/dungeon-states-of-ruin", response_model=list[RandomDungeonStateOfRuinRead])
async def list_random_dungeon_states_of_ruin(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomDungeonStateOfRuin))
    return result.scalars().all()


@router.get("/dungeon-quirks", response_model=list[RandomDungeonQuirkRead])
async def list_random_dungeon_quirks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomDungeonQuirk))
    return result.scalars().all()


@router.get("/shop-types", response_model=list[RandomShopTypeRead])
async def list_random_shop_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomShopType))
    return result.scalars().all()


@router.get("/tavern-name-parts", response_model=list[RandomTavernNamePartRead])
async def list_random_tavern_name_parts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomTavernNamePart))
    return result.scalars().all()


@router.get("/settlement-defining-traits", response_model=list[RandomSettlementDefiningTraitRead])
async def list_random_settlement_defining_traits(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomSettlementDefiningTrait))
    return result.scalars().all()


@router.get("/settlement-claims-to-fame", response_model=list[RandomSettlementClaimToFameRead])
async def list_random_settlement_claims_to_fame(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomSettlementClaimToFame))
    return result.scalars().all()


@router.get("/settlement-calamities", response_model=list[RandomSettlementCalamityRead])
async def list_random_settlement_calamities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomSettlementCalamity))
    return result.scalars().all()


@router.get("/settlement-local-leaders", response_model=list[RandomSettlementLocalLeaderRead])
async def list_random_settlement_local_leaders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomSettlementLocalLeader))
    return result.scalars().all()


@router.get("/settlement-economic-sources", response_model=list[RandomSettlementEconomicSourceRead])
async def list_random_settlement_economic_sources(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomSettlementEconomicSource))
    return result.scalars().all()


@router.get("/settlement-rumors-hooks", response_model=list[RandomSettlementRumorHookRead])
async def list_random_settlement_rumors_hooks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RandomSettlementRumorHook))
    return result.scalars().all()
