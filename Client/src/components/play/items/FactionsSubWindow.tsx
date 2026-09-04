import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import { ItemsSearchFilterBar, type FilterGroupDef } from './ItemsSearchFilterBar';
import { PinnableItemRow } from './PinnableItemRow';
import { ChipRow } from '../../notes/FactionPreviewCard';
import { useFactionStore, getFactionsForCampaign } from '../../../store/useFactionStore';
import { usePlayItemsStore, getPlayItemsState, getSlotItems } from '../../../store/usePlayItemsStore';
import type { PaneSlot } from '../layout/playLayoutTrees';
import { thinScrollbarSx, FLOATING_SCROLLBAR_CLASS } from '../../../theme/scrollbarSx';

interface FactionsSubWindowProps {
  worldId: string;
  campaignId: string;
  /** Which Items window this is - all pin/open/expand state below is scoped to it. */
  slot: PaneSlot;
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
  const focusItem = usePlayItemsStore((s) => s.focusItem);
  const pinItem = usePlayItemsStore((s) => s.pinItem);
  const unpinItem = usePlayItemsStore((s) => s.unpinItem);
  const toggleExpanded = usePlayItemsStore((s) => s.toggleExpanded);
  const slotState = getSlotItems(getPlayItemsState(byCampaignId, campaignId), slot);
  const pinned = slotState.pinnedByKind.factions;
  const current = slotState.currentByKind.factions;
  const expanded = slotState.expandedByKind.factions;

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

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

  const filtered = !hasQuery
    ? []
    : factions.filter((f) => {
        if (typeFilter.length > 0 && !typeFilter.includes(f.factionType)) return false;
        if (!search.trim()) return true;
        return f.name.toLowerCase().includes(search.trim().toLowerCase());
      });

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
                  onToggleExpand={() => toggleExpanded(campaignId, slot, 'factions', faction.id)}
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

        <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>
          Browse
        </Typography>
        {!hasQuery ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            Search or filter to browse factions.
          </Typography>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No factions match.
          </Typography>
        ) : (
          <List dense disablePadding>
            {filtered.map((f) => (
              <ListItemButton key={f.id} onClick={() => focusItem(campaignId, slot, 'factions', f.id)} sx={{ borderRadius: 1.5 }}>
                <ListItemText
                  primary={f.name}
                  secondary={f.factionType || 'Faction'}
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
