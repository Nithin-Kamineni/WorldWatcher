import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { ItemsSearchFilterBar, type FilterGroupDef } from './ItemsSearchFilterBar';
import { ItemsBrowseSection, BROWSE_PAGE } from './ItemsBrowseSection';
import { PinnableItemRow } from './PinnableItemRow';
import { EncounterBuilderLauncher } from './BuilderLaunchers';
import { rankByUsefulness, type UsefulnessSignals } from '../../dm/randomTables/tableSearch';
import { useItemUsageStore, getItemUsage } from '../../../store/useItemUsageStore';
import { TokenThumbnail } from '../../map/TokenThumbnail';
import { EncounterCreatureRow } from './EncounterCreatureRow';
import { useEncounterStore, getEncountersForCampaign } from '../../../store/useEncounterStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../../store/useCreatureStore';
import { usePlayItemsStore, getPlayItemsState, getSlotItems, compositeId } from '../../../store/usePlayItemsStore';
import type { ItemsSurface } from '../layout/playLayoutTrees';
import { getEncounterFallbackImage, type Encounter, type NpcAttitude } from '../../../types/encounter';
import { thinScrollbarSx, FLOATING_SCROLLBAR_CLASS } from '../../../theme/scrollbarSx';

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const ATTITUDE_COLORS: Record<NpcAttitude, 'error' | 'warning' | 'default' | 'success' | 'primary'> = {
  hostile: 'error',
  unfriendly: 'warning',
  indifferent: 'default',
  friendly: 'success',
  helpful: 'primary',
};

interface EncountersSubWindowProps {
  worldId: string;
  campaignId: string;
  /** Which Items window this is - all pin/open/expand state below is scoped to it, and it is
   * also where "open this creature in Stats" opens the card. */
  slot: ItemsSurface;
}

function mobTypesFor(encounter: Encounter, creatures: ReturnType<typeof getCreaturesForCampaign>): string[] {
  const types = encounter.creatures
    .map((entry) => (entry.creatureId ? creatures.find((c) => c.id === entry.creatureId)?.type : undefined))
    .filter((t): t is string => !!t);
  return Array.from(new Set(types));
}

/** Encounters sub-window (issues.txt 10.c.4) - same search/filter/pin/collapse shell as Random
 * Tables, modeled directly on EncountersTokenTab's theme/CR/type filtering. Expanded body shows
 * the creature roster for a fixed-roster encounter, or a short "resolves via random table"
 * summary for a random-table one (10.c.4b). */
export function EncountersSubWindow({ worldId, campaignId, slot }: EncountersSubWindowProps) {
  const encountersByCampaignId = useEncounterStore((s) => s.encountersByCampaignId);
  const fetchEncountersForCampaign = useEncounterStore((s) => s.fetchEncountersForCampaign);
  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);

  const byCampaignId = usePlayItemsStore((s) => s.byCampaignId);
  const focusItemAction = usePlayItemsStore((s) => s.focusItem);
  const focusItemInTab = usePlayItemsStore((s) => s.focusItemInTab);
  const pinItem = usePlayItemsStore((s) => s.pinItem);
  const unpinItem = usePlayItemsStore((s) => s.unpinItem);
  const toggleExpandedAction = usePlayItemsStore((s) => s.toggleExpanded);
  const slotState = getSlotItems(getPlayItemsState(byCampaignId, campaignId), slot);
  const pinned = slotState.pinnedByKind.encounters;
  const current = slotState.currentByKind.encounters;
  const expanded = slotState.expandedByKind.encounters;

  // Opening an encounter, and expanding one open to read its roster, are both usefulness
  // signals - so every such action goes through these rather than calling the store directly
  // (checklist I-P8).
  const usageByCampaignId = useItemUsageStore((s) => s.byCampaignId);
  const recordUse = useItemUsageStore((s) => s.recordUse);
  const recordOpen = useItemUsageStore((s) => s.recordOpen);
  const usage = getItemUsage(usageByCampaignId, campaignId, 'encounters');

  const focusItem = (id: string) => {
    recordOpen(campaignId, 'encounters', id);
    focusItemAction(campaignId, slot, 'encounters', id);
  };
  const toggleExpanded = (id: string) => {
    if (!expanded.includes(id)) recordUse(campaignId, 'encounters', id);
    toggleExpandedAction(campaignId, slot, 'encounters', id);
  };

  /** Hands a roster creature to this same window's Stats tab, where it gets the full card and
   * can be pinned for the rest of the session. */
  const openCreatureInStats = (creatureId: string) =>
    focusItemInTab(campaignId, slot, 'stats', compositeId('creature', creatureId));

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string[]>>({ theme: [], cr: [], type: [] });
  const [limit, setLimit] = useState(BROWSE_PAGE);
  const showMore = useCallback(() => setLimit((n) => n + BROWSE_PAGE), []);

  useEffect(() => {
    fetchEncountersForCampaign(campaignId);
    fetchCreaturesForCampaign(campaignId);
  }, [campaignId, fetchEncountersForCampaign, fetchCreaturesForCampaign]);

  const encounters = getEncountersForCampaign(encountersByCampaignId, campaignId);
  const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);
  const rows = useMemo(() => encounters.map((e) => ({ encounter: e, mobTypes: mobTypesFor(e, creatures) })), [encounters, creatures]);

  const groups: FilterGroupDef[] = useMemo(
    () => [
      { key: 'theme', label: 'Theme', options: Array.from(new Set(encounters.map((e) => e.theme).filter(Boolean))).sort().map((v) => ({ value: v, label: v })) },
      { key: 'cr', label: 'Challenge rating', options: Array.from(new Set(encounters.map((e) => e.challengeRating).filter(Boolean))).sort().map((v) => ({ value: v, label: v })) },
      { key: 'type', label: 'Creature type', options: Array.from(new Set(rows.flatMap((r) => r.mobTypes))).sort().map((v) => ({ value: v, label: v })) },
    ],
    [encounters, rows],
  );

  const activeFilterCount = filters.theme.length + filters.cr.length + filters.type.length;
  const hasQuery = search.trim() !== '' || activeFilterCount > 0;

  // A narrowed result set is a fresh list - re-collapse it to the first page.
  useEffect(() => {
    setLimit(BROWSE_PAGE);
  }, [search, filters]);

  // Ranked by what this campaign has actually opened and pinned, never alphabetically, and
  // never gated behind "type something first": an Encounters sub-window opened mid-fight has to
  // lead with the fight, not with an empty pane (checklist I-P8).
  const usefulness: UsefulnessSignals = useMemo(() => ({ usage, pinnedIds: pinned }), [usage, pinned]);

  const matched = useMemo(() => {
    const q = search.trim().toLowerCase();
    const narrowed = rows.filter(({ encounter, mobTypes }) => {
      if (q && !encounter.name.toLowerCase().includes(q)) return false;
      if (filters.theme.length > 0 && !filters.theme.includes(encounter.theme)) return false;
      if (filters.cr.length > 0 && !filters.cr.includes(encounter.challengeRating)) return false;
      if (filters.type.length > 0 && !filters.type.some((t) => mobTypes.includes(t))) return false;
      return true;
    });
    return rankByUsefulness(narrowed.map((r) => r.encounter), search, usefulness);
  }, [rows, search, filters, usefulness]);

  const visible = matched.slice(0, limit);

  // Opening an item puts its row at the top of this pane, which is off-screen if the DM was
  // scrolled down the browse list - scroll back up so the click visibly lands.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (current) scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current]);

  const displayIds = [...pinned, ...(current && !pinned.includes(current) ? [current] : [])];
  const displayEncounters = displayIds.map((id) => encounters.find((e) => e.id === id)).filter((e): e is Encounter => !!e);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ItemsSearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search encounters…"
        groups={groups}
        selected={filters}
        onToggle={(key, value) => setFilters((prev) => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter((v) => v !== value) : [...prev[key], value] }))}
        onClear={() => setFilters({ theme: [], cr: [], type: [] })}
      />

      <Box ref={scrollRef} className={FLOATING_SCROLLBAR_CLASS} sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0, px: 1.25, pb: 1, ...thinScrollbarSx }}>
        {displayEncounters.length > 0 && (
          <Stack spacing={0} sx={{ mb: 1.5 }}>
            {displayEncounters.map((encounter) => {
              const isExpanded = expanded.includes(encounter.id);
              const isPinned = pinned.includes(encounter.id);
              const isRandom = encounter.resolutionType === 'random_table';
              const creatureCount = encounter.creatures.reduce((sum, e) => sum + e.quantity, 0);
              const isSocial = !isRandom && encounter.primaryType === 'social';
              const isExploration = !isRandom && encounter.primaryType === 'exploration';
              const tagline = isSocial
                ? `${encounter.npcs.length} NPC${encounter.npcs.length === 1 ? '' : 's'}${encounter.theme ? ` · ${encounter.theme}` : ''}`
                : isExploration
                  ? `${encounter.explorationBlock?.shape ? humanize(encounter.explorationBlock.shape) : 'Exploration'}${encounter.explorationBlock?.environment ? ` · ${humanize(encounter.explorationBlock.environment)}` : ''}`
                  : `${encounter.challengeRating || 'CR ?'} · ${isRandom ? 'random table' : `${creatureCount} creature${creatureCount === 1 ? '' : 's'}`}${encounter.theme ? ` · ${encounter.theme}` : ''}`;
              return (
                <PinnableItemRow
                  key={encounter.id}
                  icon={<TokenThumbnail src={getEncounterFallbackImage(encounter)} name={encounter.name} size={28} />}
                  title={encounter.name}
                  tagline={tagline}
                  pinned={isPinned}
                  onTogglePin={() => (isPinned ? unpinItem(campaignId, slot, 'encounters', encounter.id) : pinItem(campaignId, slot, 'encounters', encounter.id))}
                  expanded={isExpanded}
                  onToggleExpand={() => toggleExpanded(encounter.id)}
                  onOpenNewTab={() => window.open(`/w/${worldId}/c/${campaignId}/encounters?view=management&encounter=${encounter.id}`, '_blank')}
                >
                  {isRandom ? (
                    <Typography variant="caption" color="text.secondary">
                      Resolves via a random-table roll - use the map toolbar's Encounters tab to roll it when placing tokens.
                    </Typography>
                  ) : isSocial ? (
                    <Stack spacing={0.5}>
                      {encounter.npcs.map((npc) => (
                        <EncounterCreatureRow
                          key={npc.id}
                          creatureId={npc.npcId}
                          name={npc.name}
                          imageSrc={npc.imageSrc}
                          creature={creatures.find((c) => c.id === npc.npcId)}
                          onOpenInStats={() => openCreatureInStats(npc.npcId)}
                          trailing={
                            npc.attitude ? (
                              <Chip
                                label={humanize(npc.attitude)}
                                size="small"
                                color={ATTITUDE_COLORS[npc.attitude]}
                                variant="outlined"
                                sx={{ height: 18, fontSize: 11, flexShrink: 0 }}
                              />
                            ) : undefined
                          }
                        />
                      ))}
                      {encounter.npcs.length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                          No NPCs in this roster.
                        </Typography>
                      )}
                    </Stack>
                  ) : isExploration ? (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        {encounter.explorationBlock?.shape ? humanize(encounter.explorationBlock.shape) : 'Exploration encounter'}
                        {encounter.explorationBlock?.environment ? ` in ${humanize(encounter.explorationBlock.environment)} terrain` : ''}
                        {encounter.explorationBlock?.obstacleType ? ` - ${humanize(encounter.explorationBlock.obstacleType)}` : ''}.
                      </Typography>
                      {encounter.objective && (
                        <Typography variant="caption" color="text.secondary">
                          Objective: {encounter.objective}
                        </Typography>
                      )}
                      {!encounter.explorationBlock && (
                        <Typography variant="caption" color="text.secondary">
                          No exploration block set up yet.
                        </Typography>
                      )}
                    </Stack>
                  ) : (
                    <Stack spacing={0.5}>
                      {encounter.creatures.map((entry) => (
                        <EncounterCreatureRow
                          key={entry.id}
                          creatureId={entry.creatureId}
                          name={entry.name}
                          imageSrc={entry.imageSrc}
                          creature={entry.creatureId ? creatures.find((c) => c.id === entry.creatureId) : undefined}
                          onOpenInStats={entry.creatureId ? () => openCreatureInStats(entry.creatureId as string) : undefined}
                          trailing={<Chip label={`×${entry.quantity}`} size="small" variant="outlined" sx={{ height: 18, fontSize: 11, flexShrink: 0 }} />}
                        />
                      ))}
                      {encounter.creatures.length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                          No creatures in this roster.
                        </Typography>
                      )}
                    </Stack>
                  )}
                </PinnableItemRow>
              );
            })}
          </Stack>
        )}

        <EncounterBuilderLauncher campaignId={campaignId} slot={slot} />

        <ItemsBrowseSection
          matched={matched.length}
          total={encounters.length}
          narrowed={hasQuery}
          noun="encounters"
          emptyLabel="No encounters in this campaign yet."
          limit={limit}
          onShowMore={showMore}
        >
          <List dense disablePadding>
            {visible.map((encounter) => (
              <ListItemButton key={encounter.id} onClick={() => focusItem(encounter.id)} sx={{ borderRadius: 1.5 }}>
                <ListItemText
                  primary={encounter.name}
                  secondary={`${encounter.challengeRating || 'CR ?'}${encounter.theme ? ` · ${encounter.theme}` : ''}`}
                  slotProps={{ primary: { sx: { fontSize: 13.5 } }, secondary: { sx: { fontSize: 11.5 } } }}
                />
              </ListItemButton>
            ))}
          </List>
        </ItemsBrowseSection>
      </Box>
    </Box>
  );
}
