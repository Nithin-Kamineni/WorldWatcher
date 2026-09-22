import { useEffect, useMemo } from 'react';
import { useCreatureStore, getCreaturesForCampaign } from '../store/useCreatureStore';
import { useSpellStore, getSpellsForCampaign } from '../store/useSpellStore';
import { useEncounterStore, getEncountersForCampaign } from '../store/useEncounterStore';
import { useFactionStore, getFactionsForCampaign } from '../store/useFactionStore';
import { useArticleStore, getArticlesForWorld } from '../store/useArticleStore';
import { useCampaignStore, getMapsForCampaign } from '../store/useCampaignStore';
import { EMPTY_RANDOM_TABLE_RESULTS, useRandomTableStore } from '../store/useRandomTableStore';
import type { EntityRefType } from '../utils/bbcode';
import type { ArticleCategory } from '../types/article';

export interface MentionableEntity {
  id: string;
  type: EntityRefType;
  name: string;
  subtitle?: string;
}

/** Article categories that read as a "place" for @-mention purposes - Settlements are the
 * common case, but Geography/Building/Dungeon/Country are all locations too. */
const PLACE_CATEGORIES: ArticleCategory[] = ['settlement', 'geography', 'building', 'dungeon', 'country'];

/** Every entity the @-mention picker can search across, normalized to one shape. Loads each
 * source store on mount (idempotent - each store's fetch action already no-ops once loaded)
 * so mentions work even when a note is opened via a direct link, without visiting the DM Panel
 * or World Manager first. */
export function useMentionableEntities(worldId: string | undefined, campaignId: string | undefined): MentionableEntity[] {
  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreatures = useCreatureStore((s) => s.fetchCreaturesForCampaign);
  const spellsByCampaignId = useSpellStore((s) => s.spellsByCampaignId);
  const fetchSpells = useSpellStore((s) => s.fetchSpellsForCampaign);
  const encountersByCampaignId = useEncounterStore((s) => s.encountersByCampaignId);
  const fetchEncounters = useEncounterStore((s) => s.fetchEncountersForCampaign);
  const factionsByCampaignId = useFactionStore((s) => s.factionsByCampaignId);
  const fetchFactions = useFactionStore((s) => s.fetchFactionsForCampaign);
  const articles = useArticleStore((s) => s.articles);
  const ensureArticlesSeeded = useArticleStore((s) => s.ensureSeeded);
  const mapsByCampaignId = useCampaignStore((s) => s.mapsByCampaignId);
  const fetchMaps = useCampaignStore((s) => s.fetchMapsForCampaign);
  const randomTables = useRandomTableStore((s) => s.resultSets.mentions?.results ?? EMPTY_RANDOM_TABLE_RESULTS);
  const ensureSearchRandomTables = useRandomTableStore((s) => s.ensureSearch);

  useEffect(() => {
    if (!campaignId) return;
    fetchCreatures(campaignId);
    fetchSpells(campaignId);
    fetchEncounters(campaignId);
    fetchFactions(campaignId);
    fetchMaps(campaignId);
  }, [campaignId, fetchCreatures, fetchSpells, fetchEncounters, fetchFactions, fetchMaps]);

  useEffect(() => {
    if (worldId) ensureArticlesSeeded(worldId);
  }, [worldId, ensureArticlesSeeded]);

  // Random tables span both global reference content and campaign homebrew - a single
  // unscoped search (own_or_global, no campaign filter) covers both for @-mention purposes.
  // ensureSearch, not search: every editor and note pane on screen runs this hook, so two note
  // panes used to fetch the same 500 rows twice on mount (checklist I-U4).
  useEffect(() => {
    void ensureSearchRandomTables({ scope: 'all', limit: 500 }, 'mentions');
  }, [ensureSearchRandomTables]);

  return useMemo(() => {
    const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);
    const spells = getSpellsForCampaign(spellsByCampaignId, campaignId);
    const encounters = getEncountersForCampaign(encountersByCampaignId, campaignId);
    const factions = getFactionsForCampaign(factionsByCampaignId, campaignId);
    const places = getArticlesForWorld(articles, worldId).filter((a) => PLACE_CATEGORIES.includes(a.category));
    const maps = getMapsForCampaign(mapsByCampaignId, campaignId);

    const entities: MentionableEntity[] = [
      ...creatures.map((c) => ({ id: c.id, type: (c.category === 'npc' ? 'npc' : 'creature') as EntityRefType, name: c.name, subtitle: c.type })),
      ...spells.map((s) => ({ id: s.id, type: 'spell' as EntityRefType, name: s.name, subtitle: s.school })),
      ...encounters.map((e) => ({ id: e.id, type: 'encounter' as EntityRefType, name: e.name, subtitle: e.theme })),
      ...factions.map((f) => ({ id: f.id, type: 'faction' as EntityRefType, name: f.name, subtitle: f.factionType })),
      ...places.map((a) => ({ id: a.id, type: 'place' as EntityRefType, name: a.name, subtitle: a.category })),
      ...randomTables.map((t) => ({ id: t.id, type: 'situational_table' as EntityRefType, name: t.name, subtitle: t.sourceBook ?? undefined })),
      // Maps are the one thing a session note pointed at constantly and could not link to -
      // clicking one now opens it on the map page, loaded (checklist I-U9).
      ...maps.map((m) => ({ id: m.id, type: 'map' as EntityRefType, name: m.name, subtitle: 'Map' })),
    ];
    return entities;
  }, [
    creaturesByCampaignId,
    spellsByCampaignId,
    encountersByCampaignId,
    factionsByCampaignId,
    articles,
    mapsByCampaignId,
    randomTables,
    campaignId,
    worldId,
  ]);
}
