"""Aggregates every resource router under a single /api prefix."""
from fastapi import APIRouter

from app.api.routers import (
    assets,
    bastions,
    campaigns,
    characters,
    combats,
    conditions,
    creatures,
    effects,
    encounters,
    factions,
    items,
    locations,
    map_tokens,
    maps,
    quests,
    random_bank,
    random_encounter_tables,
    raw_entities,
    search,
    sources,
    spells,
    token_library,
)

api_router = APIRouter(prefix="/api")

api_router.include_router(campaigns.router)
api_router.include_router(characters.router)
api_router.include_router(locations.router)
api_router.include_router(factions.router)
api_router.include_router(quests.router)
api_router.include_router(bastions.facilities_router)
api_router.include_router(bastions.router)

api_router.include_router(creatures.router)
api_router.include_router(spells.router)
api_router.include_router(items.router)
api_router.include_router(conditions.router)
api_router.include_router(effects.router)
api_router.include_router(sources.router)
api_router.include_router(random_bank.router)

api_router.include_router(maps.router)
api_router.include_router(maps.floors_router)
api_router.include_router(map_tokens.floor_tokens_router)
api_router.include_router(map_tokens.tokens_router)
api_router.include_router(map_tokens.floor_shapes_router)
api_router.include_router(map_tokens.shapes_router)
api_router.include_router(token_library.router)

api_router.include_router(encounters.router)
api_router.include_router(combats.router)
api_router.include_router(random_encounter_tables.router)

api_router.include_router(assets.router)
api_router.include_router(raw_entities.router)
api_router.include_router(search.router)
