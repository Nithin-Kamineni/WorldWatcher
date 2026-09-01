import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { ItemsSearchFilterBar, type FilterGroupDef } from './ItemsSearchFilterBar';
import { PinnableItemRow } from './PinnableItemRow';
import { TokenThumbnail } from '../../map/TokenThumbnail';
import { useEncounterStore, getEncountersForCampaign } from '../../../store/useEncounterStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../../store/useCreatureStore';
import { usePlayItemsStore } from '../../../store/usePlayItemsStore';
import { getEncounterFallbackImage, type Encounter } from '../../../types/encounter';
import { thinScrollbarSx, FLOATING_SCROLLBAR_CLASS } from '../../../theme/scrollbarSx';

interface EncountersSubWindowProps {
  worldId: string;
  campaignId: string;
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
export function EncountersSubWindow({ worldId, campaignId }: EncountersSubWindowProps) {
  const encountersByCampaignId = useEncounterStore((s) => s.encountersByCampaignId);
  const fetchEncountersForCampaign = useEncounterStore((s) => s.fetchEncountersForCampaign);
  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);

  const byCampaignId = usePlayItemsStore((s) => s.byCampaignId);
  const selectItem = usePlayItemsStore((s) => s.selectItem);
  const pinItem = usePlayItemsStore((s) => s.pinItem);
  const unpinItem = usePlayItemsStore((s) => s.unpinItem);
  const toggleExpanded = usePlayItemsStore((s) => s.toggleExpanded);
  const campaignState = byCampaignId[campaignId];
  const pinned = campaignState?.pinnedByKind.encounters ?? [];
  const current = campaignState?.currentByKind.encounters ?? null;
  const expanded = campaignState?.expandedByKind.encounters ?? [];

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string[]>>({ theme: [], cr: [], type: [] });

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

  const filtered = !hasQuery
    ? []
    : rows.filter(({ encounter, mobTypes }) => {
        const q = search.trim().toLowerCase();
        if (q && !encounter.name.toLowerCase().includes(q)) return false;
        if (filters.theme.length > 0 && !filters.theme.includes(encounter.theme)) return false;
        if (filters.cr.length > 0 && !filters.cr.includes(encounter.challengeRating)) return false;
        if (filters.type.length > 0 && !filters.type.some((t) => mobTypes.includes(t))) return false;
        return true;
      });

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

      <Box className={FLOATING_SCROLLBAR_CLASS} sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0, px: 1.25, pb: 1, ...thinScrollbarSx }}>
        {displayEncounters.length > 0 && (
          <Stack spacing={0} sx={{ mb: 1.5 }}>
            {displayEncounters.map((encounter) => {
              const isExpanded = expanded.includes(encounter.id);
              const isPinned = pinned.includes(encounter.id);
              const isRandom = encounter.resolutionType === 'random_table';
              const creatureCount = encounter.creatures.reduce((sum, e) => sum + e.quantity, 0);
              return (
                <PinnableItemRow
                  key={encounter.id}
                  icon={<TokenThumbnail src={getEncounterFallbackImage(encounter)} name={encounter.name} size={28} />}
                  title={encounter.name}
                  tagline={`${encounter.challengeRating || 'CR ?'} · ${isRandom ? 'random table' : `${creatureCount} creature${creatureCount === 1 ? '' : 's'}`}${encounter.theme ? ` · ${encounter.theme}` : ''}`}
                  pinned={isPinned}
                  onTogglePin={() => (isPinned ? unpinItem(campaignId, 'encounters', encounter.id) : pinItem(campaignId, 'encounters', encounter.id))}
                  expanded={isExpanded}
                  onToggleExpand={() => toggleExpanded(campaignId, 'encounters', encounter.id)}
                  onOpenNewTab={() => window.open(`/w/${worldId}/c/${campaignId}/encounters?view=management&encounter=${encounter.id}`, '_blank')}
                >
                  {isRandom ? (
                    <Typography variant="caption" color="text.secondary">
                      Resolves via a random-table roll - use the map toolbar's Encounters tab to roll it when placing tokens.
                    </Typography>
                  ) : (
                    <Stack spacing={0.5}>
                      {encounter.creatures.map((entry) => (
                        <Stack key={entry.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <TokenThumbnail src={entry.imageSrc} name={entry.name} size={22} />
                          <Typography variant="caption" sx={{ flexGrow: 1 }} noWrap>
                            {entry.name}
                          </Typography>
                          <Chip label={`×${entry.quantity}`} size="small" variant="outlined" sx={{ height: 18, fontSize: 11 }} />
                        </Stack>
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

        <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>
          Browse
        </Typography>
        {!hasQuery ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            Search or filter to browse encounters.
          </Typography>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No encounters match.
          </Typography>
        ) : (
          <List dense disablePadding>
            {filtered.map(({ encounter }) => (
              <ListItemButton key={encounter.id} onClick={() => selectItem(campaignId, 'encounters', encounter.id)} sx={{ borderRadius: 1.5 }}>
                <ListItemText
                  primary={encounter.name}
                  secondary={`${encounter.challengeRating || 'CR ?'}${encounter.theme ? ` · ${encounter.theme}` : ''}`}
                  slotProps={{ primary: { sx: { fontSize: 13.5 } }, secondary: { sx: { fontSize: 11.5 } } }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
