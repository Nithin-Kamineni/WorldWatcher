import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import { ItemsSearchFilterBar, type FilterGroupDef } from './ItemsSearchFilterBar';
import { ItemsBrowseSection, BROWSE_PAGE } from './ItemsBrowseSection';
import { PinnableItemRow } from './PinnableItemRow';
import { ChipRow } from '../../notes/FactionPreviewCard';
import { rankByUsefulness, type UsefulnessSignals } from '../../dm/randomTables/tableSearch';
import { useFactionStore, getFactionsForCampaign } from '../../../store/useFactionStore';
import { useItemUsageStore, getItemUsage } from '../../../store/useItemUsageStore';
import { usePlayItemsStore, getPlayItemsState, getSlotItems } from '../../../store/usePlayItemsStore';
import type { ItemsSurface } from '../layout/playLayoutTrees';
import { thinScrollbarSx, FLOATING_SCROLLBAR_CLASS } from '../../../theme/scrollbarSx';

interface FactionsSubWindowProps {
  worldId: string;
  campaignId: string;
  /** Which Items window this is - all pin/open/expand state below is scoped to it. */
  slot: ItemsSurface;
}

/** Factions sub-window - same search/filter/pin/collapse shell as the other 4 Items
 * sub-windows. Factions have no per-entity deep-link target in WorldManagerPage today, so
 * "open in new tab" only lands on the Factions folder, not the specific faction. */
export function FactionsSubWindow({ worldId, campaignId, slot }: FactionsSubWindowProps) {
  const factionsByCampaignId = useFactionStore((s) => s.factionsByCampaignId);
  const fetchFactionsForCampaign = useFactionStore((s) => s.fetchFactionsForCampaign);

  useEffect(() => {
    fetchFactionsForCampaign(campaignId);
  }, [campaignId, fetchFactionsForCampaign]);

  const factions = getFactionsForCampaign(factionsByCampaignId, campaignId);

  const byCampaignId = usePlayItemsStore((s) => s.byCampaignId);
  const focusItemAction = usePlayItemsStore((s) => s.focusItem);
  const pinItem = usePlayItemsStore((s) => s.pinItem);
  const unpinItem = usePlayItemsStore((s) => s.unpinItem);
  const toggleExpandedAction = usePlayItemsStore((s) => s.toggleExpanded);
  const slotState = getSlotItems(getPlayItemsState(byCampaignId, campaignId), slot);
  const pinned = slotState.pinnedByKind.factions;
  const current = slotState.currentByKind.factions;
  const expanded = slotState.expandedByKind.factions;

  // Opening a faction, and reading one open, are both usefulness signals - so every such action
  // goes through these rather than calling the store directly (checklist I-P8).
  const usageByCampaignId = useItemUsageStore((s) => s.byCampaignId);
  const recordUse = useItemUsageStore((s) => s.recordUse);
  const recordOpen = useItemUsageStore((s) => s.recordOpen);
  const usage = getItemUsage(usageByCampaignId, campaignId, 'factions');

  const focusItem = (id: string) => {
    recordOpen(campaignId, 'factions', id);
    focusItemAction(campaignId, slot, 'factions', id);
  };
  const toggleExpanded = (id: string) => {
    if (!expanded.includes(id)) recordUse(campaignId, 'factions', id);
    toggleExpandedAction(campaignId, slot, 'factions', id);
  };

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [limit, setLimit] = useState(BROWSE_PAGE);
  const showMore = useCallback(() => setLimit((n) => n + BROWSE_PAGE), []);

  const typeGroup: FilterGroupDef[] = useMemo(
    () => [
      {
        key: 'type',
        label: 'Type',
        options: Array.from(new Set(factions.map((f) => f.factionType).filter(Boolean)))
          .sort()
          .map((v) => ({ value: v, label: v })),
      },
    ],
    [factions],
  );

  const hasQuery = search.trim() !== '' || typeFilter.length > 0;

  // A narrowed result set is a fresh list - re-collapse it to the first page.
  useEffect(() => {
    setLimit(BROWSE_PAGE);
  }, [search, typeFilter]);

  // Ranked by what this campaign has actually opened and pinned, never alphabetically, and
  // never gated behind "type something first": a sub-window opened mid-fight has to lead with
  // the factions in play, not with an empty pane (checklist I-P8).
  const usefulness: UsefulnessSignals = useMemo(() => ({ usage, pinnedIds: pinned }), [usage, pinned]);

  const matched = useMemo(() => {
    const q = search.trim().toLowerCase();
    const narrowed = factions.filter((f) => {
      if (typeFilter.length > 0 && !typeFilter.includes(f.factionType)) return false;
      return !q || f.name.toLowerCase().includes(q);
    });
    return rankByUsefulness(narrowed, search, usefulness);
  }, [factions, search, typeFilter, usefulness]);

  const visible = matched.slice(0, limit);

  // Opening an item puts its row at the top of this pane, which is off-screen if the DM was
  // scrolled down the browse list - scroll back up so the click visibly lands.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (current) scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current]);

  const displayIds = [...pinned, ...(current && !pinned.includes(current) ? [current] : [])];
  const displayFactions = displayIds.map((id) => factions.find((f) => f.id === id)).filter((f): f is NonNullable<typeof f> => !!f);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ItemsSearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search factions…"
        groups={typeGroup}
        selected={{ type: typeFilter }}
        onToggle={(_key, value) => setTypeFilter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))}
        onClear={() => setTypeFilter([])}
      />

      <Box ref={scrollRef} className={FLOATING_SCROLLBAR_CLASS} sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0, px: 1.25, pb: 1, ...thinScrollbarSx }}>
        {displayFactions.length > 0 && (
          <Stack spacing={0} sx={{ mb: 1.5 }}>
            {displayFactions.map((faction) => {
              const isExpanded = expanded.includes(faction.id);
              const isPinned = pinned.includes(faction.id);
              return (
                <PinnableItemRow
                  key={faction.id}
                  icon={<Diversity3Icon fontSize="small" color="action" />}
                  title={faction.name}
                  tagline={faction.factionType || 'Faction'}
                  pinned={isPinned}
                  onTogglePin={() => (isPinned ? unpinItem(campaignId, slot, 'factions', faction.id) : pinItem(campaignId, slot, 'factions', faction.id))}
                  expanded={isExpanded}
                  onToggleExpand={() => toggleExpanded(faction.id)}
                  onOpenNewTab={() => window.open(`/w/${worldId}/manager?folder=factions`, '_blank')}
                >
                  <Stack spacing={0.5}>
                    {faction.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', mb: 0.5 }}>
                        {faction.description}
                      </Typography>
                    )}
                    <ChipRow label="Goals" values={faction.goals} />
                    <ChipRow label="Beliefs" values={faction.beliefs} />
                    <ChipRow label="Resources" values={faction.resources} />
                    <ChipRow label="Locations" values={faction.locations} />
                    <ChipRow label="Members" values={faction.members} />
                  </Stack>
                </PinnableItemRow>
              );
            })}
          </Stack>
        )}

        <ItemsBrowseSection
          matched={matched.length}
          total={factions.length}
          narrowed={hasQuery}
          noun="factions"
          emptyLabel="No factions in this campaign yet."
          limit={limit}
          onShowMore={showMore}
        >
          <List dense disablePadding>
            {visible.map((f) => (
              <ListItemButton key={f.id} onClick={() => focusItem(f.id)} sx={{ borderRadius: 1.5 }}>
                <ListItemText
                  primary={f.name}
                  secondary={f.factionType || 'Faction'}
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
