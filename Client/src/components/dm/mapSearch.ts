import {
  normalizeSearchText,
  queryTokens,
  rankByUsefulness,
  tokenMatchesFuzzy,
  type UsefulnessSignals,
} from './randomTables/tableSearch';
import { getMapKindOption, MAP_SETTING_OPTIONS, type MapData, type MapKind, type MapSetting } from '../../types/map';

/** Client-side search + faceting for the campaign's map library, built on the same primitives
 * the random-table library searches with (tableSearch.ts) rather than a second, weaker copy.
 *
 * The Maps page used to match `map.name.toLowerCase().includes(query)` and nothing else, so a
 * map you remembered by where it sat in the world ("Frosthold pass"), by what happens on it
 * ("the ambush"), or by one of its floor names ("crypt") was unfindable unless you also
 * remembered its title exactly, typo-free. Everything a DM could plausibly remember a map by is
 * folded into one haystack here, matched with the shared fuzzy token matcher, and the facets
 * (type / setting / location) carry live counts so the filter panel says how much is behind
 * each chip before you click it. */

export interface MapSearchIndex {
  /** Map id -> the text every query token is matched against. */
  text: Map<string, string>;
}

export function mapSettingLabel(setting: MapSetting | undefined): string {
  return MAP_SETTING_OPTIONS.find((option) => option.value === setting)?.label ?? '';
}

export function getMapKindLabel(kind: MapKind): string {
  return getMapKindOption(kind).label;
}

/** Built once per map-list change so typing a character does not re-derive kind labels and
 * floor names for every map in the campaign. */
export function buildMapSearchIndex(maps: MapData[]): MapSearchIndex {
  const text = new Map<string, string>();
  maps.forEach((map) => {
    const parts = [
      map.name,
      map.description,
      map.location ?? '',
      map.activity ?? '',
      mapSettingLabel(map.setting),
      map.kinds.map((kind) => getMapKindOption(kind).label).join(' '),
      map.floors.map((floor) => floor.name).join(' '),
      (map.customDetails ?? []).map((detail) => `${detail.label} ${detail.value}`).join(' '),
    ];
    text.set(map.id, normalizeSearchText(parts.join(' \u0000 ')));
  });
  return { text };
}

/** Every token must match. Strict substring pass first, falling back to the fuzzy pass only
 * when that finds nothing - same rule as the table library, so a correctly-typed query is
 * never diluted by near-misses. */
export function filterMapsByQuery(maps: MapData[], query: string, index: MapSearchIndex): MapData[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return maps;
  const strict = maps.filter((map) => {
    const text = index.text.get(map.id);
    return !!text && tokens.every((token) => text.includes(token));
  });
  if (strict.length > 0) return strict;
  return maps.filter((map) => {
    const text = index.text.get(map.id);
    return !!text && tokens.every((token) => tokenMatchesFuzzy(token, text));
  });
}

/** Relevance blended with recency, through the shared ranker. A map has no roll/pin signals to
 * offer, so "how recently was it edited" stands in for usefulness - which is the right proxy
 * here: the map you touched this afternoon is the one you are prepping tonight. */
export function rankMapsByQuery(maps: MapData[], query: string): MapData[] {
  const usage: NonNullable<UsefulnessSignals['usage']> = {};
  maps.forEach((map) => {
    usage[map.id] = { rolls: 0, opens: 1, lastUsedAt: map.updatedAt };
  });
  return rankByUsefulness(maps, query, { usage });
}

export type MapSortKey = 'relevance' | 'updated' | 'name' | 'floors';

export const MAP_SORT_OPTIONS: { value: MapSortKey; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'floors', label: 'Most floors' },
];

export function sortMaps(maps: MapData[], sort: MapSortKey, query: string): MapData[] {
  if (sort === 'relevance') return rankMapsByQuery(maps, query);
  const sorted = [...maps];
  if (sort === 'updated') sorted.sort((a, b) => b.updatedAt - a.updatedAt);
  else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  else sorted.sort((a, b) => b.floors.length - a.floors.length || a.name.localeCompare(b.name));
  return sorted;
}

export function computeKindCounts(maps: MapData[]): Map<MapKind, number> {
  const counts = new Map<MapKind, number>();
  maps.forEach((map) => map.kinds.forEach((kind) => counts.set(kind, (counts.get(kind) ?? 0) + 1)));
  return counts;
}

export function computeSettingCounts(maps: MapData[]): Map<MapSetting, number> {
  const counts = new Map<MapSetting, number>();
  maps.forEach((map) => {
    if (map.setting) counts.set(map.setting, (counts.get(map.setting) ?? 0) + 1);
  });
  return counts;
}

/** Locations are free text, so they are faceted by their exact trimmed value and offered
 * busiest-first - enough to turn "everything in the Frosthold pass" into one click without
 * asking the DM to model locations as a real entity. */
export function computeLocationCounts(maps: MapData[]): Map<string, number> {
  const counts = new Map<string, number>();
  maps.forEach((map) => {
    const location = map.location?.trim();
    if (location) counts.set(location, (counts.get(location) ?? 0) + 1);
  });
  return counts;
}

export interface MapFilters {
  kinds: MapKind[];
  settings: MapSetting[];
  locations: string[];
}

export const EMPTY_MAP_FILTERS: MapFilters = { kinds: [], settings: [], locations: [] };

export function hasActiveMapFilters(filters: MapFilters): boolean {
  return filters.kinds.length > 0 || filters.settings.length > 0 || filters.locations.length > 0;
}

export function countActiveMapFilters(filters: MapFilters): number {
  return filters.kinds.length + filters.settings.length + filters.locations.length;
}

/** Facets are OR within a group and AND across groups - "a battle OR city map, that is also
 * indoors", which is how a chip row reads to the person clicking it. */
export function applyMapFilters(maps: MapData[], filters: MapFilters): MapData[] {
  return maps.filter((map) => {
    if (filters.kinds.length > 0 && !map.kinds.some((kind) => filters.kinds.includes(kind))) return false;
    if (filters.settings.length > 0 && (!map.setting || !filters.settings.includes(map.setting))) return false;
    if (filters.locations.length > 0 && !filters.locations.includes(map.location?.trim() ?? '')) return false;
    return true;
  });
}
