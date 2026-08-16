/** Backend persistence for maps/floors/tokens/shapes, diffed against
 * whatever local edit just happened. This is the one choke point ALL
 * of MapPage's floor mutations pass through (mutateActiveFloor /
 * mutateActiveFloorWithHistory / undo / redo all call
 * useCampaignStore's updateFloorInMap), so doing the diff here - rather
 * than in each individual handler - is what makes undo/redo persist
 * correctly for free instead of only the "forward" edits.
 *
 * Every create call below passes its local id straight through to the
 * backend (Server/app/api/utils.py: create_kwargs honors a
 * client-supplied id). That means local ids and backend ids are always
 * the same value, so callers never need an "old id -> new id"
 * translation step after a create resolves - local state can be
 * applied optimistically and the network call just needs to succeed.
 */
import * as mapsApi from '../../api/resources/maps';
import * as tokensApi from '../../api/resources/mapTokens';
import { resolveImageAsset } from '../../api/adapters';
import type { MapCustomDetail, MapData, MapFloor } from '../../types/map';
import type { PlacedToken } from '../../types/token';
import type { AoEShape } from '../../types/shape';

function mapScalarPayload(map: MapData): Record<string, unknown> {
  return {
    name: map.name,
    description: map.description || null,
    map_kinds: map.kinds,
    map_location_text: map.location || null,
    setting: map.setting ?? null,
    activity: map.activity || null,
    grid_enabled: map.gridEnabled,
    grid_size: map.gridSize,
    grid_color: map.gridColor,
    grid_thickness: map.gridThickness,
    grid_type: map.gridType,
    settings: map.customDetails && map.customDetails.length > 0 ? { customDetails: map.customDetails } : null,
  };
}

export function customDetailsFromSettings(settings: unknown): MapCustomDetail[] | undefined {
  if (settings && typeof settings === 'object' && Array.isArray((settings as Record<string, unknown>).customDetails)) {
    return (settings as Record<string, unknown>).customDetails as MapCustomDetail[];
  }
  return undefined;
}

async function createFloorOnBackend(mapId: string, floor: MapFloor, sortOrder: number): Promise<void> {
  const { assetId } = await resolveImageAsset(floor.imageSrc, 'map');
  await mapsApi.createMapFloor(mapId, {
    id: floor.id,
    map_id: mapId,
    name: floor.name,
    sort_order: sortOrder,
    background_asset_id: assetId,
    flipped_horizontal: floor.flippedHorizontal ?? false,
    flipped_vertical: floor.flippedVertical ?? false,
    rotation: floor.rotation ?? 0,
    raw_data: { initiative: floor.initiative },
  });
}

/** Creates a brand-new map and all of its floors on the backend. Local
 * ids are preserved end to end, so nothing needs to be re-mapped. */
export async function createMapOnBackend(campaignId: string, map: MapData): Promise<void> {
  await mapsApi.createMap({ id: map.id, campaign_id: campaignId, ...mapScalarPayload(map) });

  for (let i = 0; i < map.floors.length; i += 1) {
    await createFloorOnBackend(map.id, map.floors[i], i);
  }
  const resolvedPrimary = map.primaryFloorId || map.floors[0]?.id;
  if (resolvedPrimary) {
    await mapsApi.updateMap(map.id, { primary_floor_id: resolvedPrimary });
  }
}

/** Diffs oldMap.floors vs newMap.floors (add/remove/rename/re-image)
 * and persists the map's own scalar fields. Never touches floor
 * CONTENTS (tokens/shapes/initiative) - see syncFloorContentChange. */
export async function updateMapOnBackend(mapId: string, oldMap: MapData, newMap: MapData): Promise<void> {
  const oldIds = new Set(oldMap.floors.map((f) => f.id));
  const newIds = new Set(newMap.floors.map((f) => f.id));

  const toCreate = newMap.floors.filter((f) => !oldIds.has(f.id));
  const toDelete = oldMap.floors.filter((f) => !newIds.has(f.id));
  const carried = newMap.floors.filter((f) => oldIds.has(f.id));

  const baseSortOrder = carried.length;
  for (let i = 0; i < toCreate.length; i += 1) {
    await createFloorOnBackend(mapId, toCreate[i], baseSortOrder + i);
  }

  await mapsApi.updateMap(mapId, { ...mapScalarPayload(newMap), primary_floor_id: newMap.primaryFloorId || null });

  for (const floor of carried) {
    const old = oldMap.floors.find((f) => f.id === floor.id);
    if (!old) continue;
    if (old.name !== floor.name || old.imageSrc !== floor.imageSrc) {
      const { assetId } = old.imageSrc !== floor.imageSrc ? await resolveImageAsset(floor.imageSrc, 'map') : { assetId: undefined };
      await mapsApi.updateMapFloor(floor.id, {
        name: floor.name,
        ...(assetId ? { background_asset_id: assetId } : {}),
      });
    }
  }

  for (const floor of toDelete) {
    await mapsApi.deleteMapFloor(floor.id);
  }
}

export async function deleteMapOnBackend(mapId: string): Promise<void> {
  await mapsApi.deleteMap(mapId);
}

// ---------------------------------------------------------------------
// Floor CONTENTS sync (tokens, shapes, flip/rotation, initiative) - the
// path every in-map-editor mutation goes through.
// ---------------------------------------------------------------------

function tokenFieldsEqual(a: PlacedToken, b: PlacedToken): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.name === b.name &&
    a.size === b.size &&
    a.outlineColor === b.outlineColor &&
    a.imageSrc === b.imageSrc &&
    JSON.stringify(a.effects) === JSON.stringify(b.effects) &&
    JSON.stringify(a.hp) === JSON.stringify(b.hp) &&
    a.concentrating === b.concentrating &&
    JSON.stringify(a.deathSaves) === JSON.stringify(b.deathSaves) &&
    a.notes === b.notes &&
    a.encounterEntryId === b.encounterEntryId &&
    a.creatureId === b.creatureId
  );
}

async function syncTokens(floorId: string, oldTokens: PlacedToken[], newTokens: PlacedToken[]): Promise<void> {
  const oldById = new Map(oldTokens.map((t) => [t.id, t]));
  const newById = new Map(newTokens.map((t) => [t.id, t]));

  for (const token of newTokens) {
    const old = oldById.get(token.id);
    if (!old) {
      const { assetId } = token.imageSrc ? await resolveImageAsset(token.imageSrc, 'creature_token') : { assetId: null };
      await tokensApi.createMapToken(floorId, {
        id: token.id,
        map_floor_id: floorId,
        name: token.name,
        image_asset_id: assetId,
        x: token.x,
        y: token.y,
        size: token.size,
        outline_color: token.outlineColor,
        effects: token.effects,
        encounter_creature_id: token.encounterEntryId ?? null,
        creature_id: token.creatureId ?? null,
        current_hp: token.hp?.current ?? null,
        max_hp: token.hp?.max ?? null,
        concentrating: token.concentrating ?? false,
        death_save_successes: token.deathSaves?.successes ?? 0,
        death_save_failures: token.deathSaves?.failures ?? 0,
        notes: token.notes ?? null,
      });
    } else if (!tokenFieldsEqual(old, token)) {
      const imageChanged = old.imageSrc !== token.imageSrc;
      const { assetId } = imageChanged && token.imageSrc ? await resolveImageAsset(token.imageSrc, 'creature_token') : { assetId: undefined };
      await tokensApi.updateMapToken(token.id, {
        name: token.name,
        x: token.x,
        y: token.y,
        size: token.size,
        outline_color: token.outlineColor,
        effects: token.effects,
        creature_id: token.creatureId ?? null,
        current_hp: token.hp?.current ?? null,
        max_hp: token.hp?.max ?? null,
        concentrating: token.concentrating ?? false,
        death_save_successes: token.deathSaves?.successes ?? 0,
        death_save_failures: token.deathSaves?.failures ?? 0,
        notes: token.notes ?? null,
        ...(imageChanged && assetId ? { image_asset_id: assetId } : {}),
      });
    }
  }

  for (const token of oldTokens) {
    if (!newById.has(token.id)) {
      await tokensApi.deleteMapToken(token.id);
    }
  }
}

async function syncShapes(floorId: string, oldShapes: AoEShape[], newShapes: AoEShape[]): Promise<void> {
  const oldIds = new Set(oldShapes.map((s) => s.id));
  const newIds = new Set(newShapes.map((s) => s.id));

  for (const shape of newShapes) {
    if (!oldIds.has(shape.id)) {
      await tokensApi.createMapShape(floorId, {
        id: shape.id,
        map_floor_id: floorId,
        shape_type: shape.type,
        x: shape.x,
        y: shape.y,
        radius: shape.radius,
        rotation: shape.rotation,
        color: shape.color,
        width: shape.width ?? null,
        height: shape.height ?? null,
        points: shape.points ?? null,
        stroke_width: shape.strokeWidth ?? null,
      });
    }
  }

  for (const shape of oldShapes) {
    if (!newIds.has(shape.id)) {
      await tokensApi.deleteMapShape(shape.id);
    }
  }
}

/** Called after every local floor-content mutation (token move/add/
 * remove/update, shape draw/erase, flip/rotate, lock encounter, and
 * every initiative handler). Fire-and-forget from the store's
 * perspective - local state has already been applied synchronously by
 * the time this runs. */
export async function syncFloorContentChange(floorId: string, oldFloor: MapFloor, newFloor: MapFloor): Promise<void> {
  const metaChanged =
    oldFloor.flippedHorizontal !== newFloor.flippedHorizontal ||
    oldFloor.flippedVertical !== newFloor.flippedVertical ||
    oldFloor.rotation !== newFloor.rotation ||
    oldFloor.lockedEncounterId !== newFloor.lockedEncounterId;
  const initiativeChanged = JSON.stringify(oldFloor.initiative) !== JSON.stringify(newFloor.initiative);
  const resolvedRosterChanged =
    JSON.stringify(oldFloor.resolvedEncounterRoster ?? null) !== JSON.stringify(newFloor.resolvedEncounterRoster ?? null);

  if (metaChanged || initiativeChanged || resolvedRosterChanged) {
    await mapsApi.updateMapFloor(floorId, {
      flipped_horizontal: newFloor.flippedHorizontal ?? false,
      flipped_vertical: newFloor.flippedVertical ?? false,
      rotation: newFloor.rotation ?? 0,
      locked_encounter_id: newFloor.lockedEncounterId ?? null,
      raw_data: { initiative: newFloor.initiative, resolvedEncounterRoster: newFloor.resolvedEncounterRoster ?? null },
    });
  }

  await syncTokens(floorId, oldFloor.placedTokens, newFloor.placedTokens);
  await syncShapes(floorId, oldFloor.shapes, newFloor.shapes);
}
