import { useEffect, useMemo } from 'react';
import { useCreatureStore, getCreaturesForCampaign } from '../store/useCreatureStore';
import { useSpellStore, getSpellsForCampaign } from '../store/useSpellStore';
import { useEncounterStore, getEncountersForCampaign } from '../store/useEncounterStore';
import { useFactionStore, getFactionsForCampaign } from '../store/useFactionStore';
import { useArticleStore, getArticlesForWorld } from '../store/useArticleStore';
import { useSituationalTableStore } from '../store/useSituationalTableStore';
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
  const situationalTables = useSituationalTableStore((s) => s.tables);
  const fetchSituationalTables = useSituationalTableStore((s) => s.fetchTables);

  useEffect(() => {
    if (!campaignId) return;
    fetchCreatures(campaignId);
    fetchSpells(campaignId);
    fetchEncounters(campaignId);
    fetchFactions(campaignId);
  }, [campaignId, fetchCreatures, fetchSpells, fetchEncounters, fetchFactions]);

  useEffect(() => {
    if (worldId) ensureArticlesSeeded(worldId);
  }, [worldId, ensureArticlesSeeded]);

  // Situational tables are global reference content (not campaign-scoped) - fetchTables()
  // is a fetch-once-and-cache guarded by its own `loaded` flag, so this is safe to call
  // unconditionally on mount.
  useEffect(() => {
    fetchSituationalTables();
  }, [fetchSituationalTables]);

  return useMemo(() => {
    const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);
    const spells = getSpellsForCampaign(spellsByCampaignId, campaignId);
    const encounters = getEncountersForCampaign(encountersByCampaignId, campaignId);
    const factions = getFactionsForCampaign(factionsByCampaignId, campaignId);
    const places = getArticlesForWorld(articles, worldId).filter((a) => PLACE_CATEGORIES.includes(a.category));

    const entities: MentionableEntity[] = [
      ...creatures.map((c) => ({ id: c.id, type: (c.category === 'npc' ? 'npc' : 'creature') as EntityRefType, name: c.name, subtitle: c.type })),
      ...spells.map((s) => ({ id: s.id, type: 'spell' as EntityRefType, name: s.name, subtitle: s.school })),
      ...encounters.map((e) => ({ id: e.id, type: 'encounter' as EntityRefType, name: e.name, subtitle: e.theme })),
      ...factions.map((f) => ({ id: f.id, type: 'faction' as EntityRefType, name: f.name, subtitle: f.factionType })),
      ...places.map((a) => ({ id: a.id, type: 'place' as EntityRefType, name: a.name, subtitle: a.category })),
      ...situationalTables.map((t) => ({ id: t.id, type: 'situational_table' as EntityRefType, name: t.name, subtitle: t.theme })),
    ];
    return entities;
  }, [
    creaturesByCampaignId,
    spellsByCampaignId,
    encountersByCampaignId,
    factionsByCampaignId,
    articles,
    situationalTables,
    campaignId,
    worldId,
  ]);
}
