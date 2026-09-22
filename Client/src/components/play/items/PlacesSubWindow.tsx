import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { ItemsSearchFilterBar, type FilterGroupDef } from './ItemsSearchFilterBar';
import { ItemsBrowseSection, BROWSE_PAGE } from './ItemsBrowseSection';
import { PinnableItemRow } from './PinnableItemRow';
import { PlaceBuilderLauncher } from './BuilderLaunchers';
import { getArticleCategoryIcon } from '../../world/articleIcons';
import { rankByUsefulness, type UsefulnessSignals } from '../../dm/randomTables/tableSearch';
import { useArticleStore, getArticlesForWorld } from '../../../store/useArticleStore';
import { useItemUsageStore, getItemUsage } from '../../../store/useItemUsageStore';
import { usePlayItemsStore, getPlayItemsState, getSlotItems } from '../../../store/usePlayItemsStore';
import type { ItemsSurface } from '../layout/playLayoutTrees';
import { ARTICLE_TEMPLATES, getArticleTemplatesByGroup } from '../../../types/article';
import { thinScrollbarSx, FLOATING_SCROLLBAR_CLASS } from '../../../theme/scrollbarSx';

interface PlacesSubWindowProps {
  worldId: string;
  campaignId: string;
  /** Which Items window this is - all pin/open/expand state below is scoped to it. */
  slot: ItemsSurface;
}

const PLACE_CATEGORIES = new Set(getArticleTemplatesByGroup('Places').map((t) => t.category));

/** Places sub-window (issues.txt 10.c.6) - countries/settlements/buildings/dungeons, filtered
 * out of the world's Article catalog by category (see types/article.ts's Places group). Same
 * pin/collapse shell; expanded body is a compact summary since the full ArticleDetailPage
 * layout doesn't fit this space. */
export function PlacesSubWindow({ worldId, campaignId, slot }: PlacesSubWindowProps) {
  const articles = useArticleStore((s) => s.articles);
  const ensureSeeded = useArticleStore((s) => s.ensureSeeded);

  useEffect(() => {
    ensureSeeded(worldId);
  }, [worldId, ensureSeeded]);

  const places = getArticlesForWorld(articles, worldId).filter((a) => PLACE_CATEGORIES.has(a.category));

  const byCampaignId = usePlayItemsStore((s) => s.byCampaignId);
  const focusItemAction = usePlayItemsStore((s) => s.focusItem);
  const pinItem = usePlayItemsStore((s) => s.pinItem);
  const unpinItem = usePlayItemsStore((s) => s.unpinItem);
  const toggleExpandedAction = usePlayItemsStore((s) => s.toggleExpanded);
  const slotState = getSlotItems(getPlayItemsState(byCampaignId, campaignId), slot);
  const pinned = slotState.pinnedByKind.places;
  const current = slotState.currentByKind.places;
  const expanded = slotState.expandedByKind.places;

  // Opening a place, and reading one open, are both usefulness signals - so every such action
  // goes through these rather than calling the store directly (checklist I-P8).
  const usageByCampaignId = useItemUsageStore((s) => s.byCampaignId);
  const recordUse = useItemUsageStore((s) => s.recordUse);
  const recordOpen = useItemUsageStore((s) => s.recordOpen);
  const usage = getItemUsage(usageByCampaignId, campaignId, 'places');

  const focusItem = (id: string) => {
    recordOpen(campaignId, 'places', id);
    focusItemAction(campaignId, slot, 'places', id);
  };
  const toggleExpanded = (id: string) => {
    if (!expanded.includes(id)) recordUse(campaignId, 'places', id);
    toggleExpandedAction(campaignId, slot, 'places', id);
  };

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [limit, setLimit] = useState(BROWSE_PAGE);
  const showMore = useCallback(() => setLimit((n) => n + BROWSE_PAGE), []);

  const categoryGroup: FilterGroupDef[] = useMemo(
    () => [
      {
        key: 'category',
        label: 'Type',
        options: Array.from(PLACE_CATEGORIES).map((c) => ({ value: c, label: ARTICLE_TEMPLATES[c].label })),
      },
    ],
    [],
  );

  const hasQuery = search.trim() !== '' || categoryFilter.length > 0;

  // A narrowed result set is a fresh list - re-collapse it to the first page.
  useEffect(() => {
    setLimit(BROWSE_PAGE);
  }, [search, categoryFilter]);

  // Ranked by what this campaign has actually opened and pinned, never alphabetically, and
  // never gated behind "type something first": the tavern the party is standing in has to be
  // reachable without remembering its name (checklist I-P8).
  const usefulness: UsefulnessSignals = useMemo(() => ({ usage, pinnedIds: pinned }), [usage, pinned]);

  const matched = useMemo(() => {
    const q = search.trim().toLowerCase();
    const narrowed = places.filter((a) => {
      if (categoryFilter.length > 0 && !categoryFilter.includes(a.category)) return false;
      return !q || a.name.toLowerCase().includes(q);
    });
    return rankByUsefulness(narrowed, search, usefulness);
    // `places` is derived from the article store on every render - depend on its stable id form
    // so this does not re-rank the whole catalog constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places.map((a) => a.id).join(','), search, categoryFilter, usefulness]);

  const visible = matched.slice(0, limit);

  // Opening an item puts its row at the top of this pane, which is off-screen if the DM was
  // scrolled down the browse list - scroll back up so the click visibly lands.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (current) scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current]);

  const displayIds = [...pinned, ...(current && !pinned.includes(current) ? [current] : [])];
  const displayPlaces = displayIds.map((id) => places.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ItemsSearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search places…"
        groups={categoryGroup}
        selected={{ category: categoryFilter }}
        onToggle={(_key, value) => setCategoryFilter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))}
        onClear={() => setCategoryFilter([])}
      />

      <Box ref={scrollRef} className={FLOATING_SCROLLBAR_CLASS} sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0, px: 1.25, pb: 1, ...thinScrollbarSx }}>
        {displayPlaces.length > 0 && (
          <Stack spacing={0} sx={{ mb: 1.5 }}>
            {displayPlaces.map((place) => {
              const isExpanded = expanded.includes(place.id);
              const isPinned = pinned.includes(place.id);
              const template = ARTICLE_TEMPLATES[place.category];
              return (
                <PinnableItemRow
                  key={place.id}
                  icon={getArticleCategoryIcon(template.icon)}
                  title={place.name}
                  tagline={template.label}
                  pinned={isPinned}
                  onTogglePin={() => (isPinned ? unpinItem(campaignId, slot, 'places', place.id) : pinItem(campaignId, slot, 'places', place.id))}
                  expanded={isExpanded}
                  onToggleExpand={() => toggleExpanded(place.id)}
                  onOpenNewTab={() => window.open(`/w/${worldId}/manager/entry/${place.id}`, '_blank')}
                >
                  <Stack spacing={0.5}>
                    {Object.entries(place.fieldValues)
                      .slice(0, 4)
                      .map(([key, value]) =>
                        value ? (
                          <Typography key={key} variant="caption" color="text.secondary">
                            <strong>{template.sections.flatMap((s) => s.fields).find((f) => f.key === key)?.label ?? key}:</strong> {value}
                          </Typography>
                        ) : null,
                      )}
                    {place.body && (
                      <Typography variant="caption" color="text.secondary">
                        {place.body.slice(0, 140)}
                        {place.body.length > 140 ? '…' : ''}
                      </Typography>
                    )}
                  </Stack>
                </PinnableItemRow>
              );
            })}
          </Stack>
        )}

        <PlaceBuilderLauncher worldId={worldId} campaignId={campaignId} slot={slot} />

        <ItemsBrowseSection
          matched={matched.length}
          total={places.length}
          narrowed={hasQuery}
          noun="places"
          emptyLabel="No places in this world yet."
          limit={limit}
          onShowMore={showMore}
        >
          <List dense disablePadding>
            {visible.map((a) => (
              <ListItemButton key={a.id} onClick={() => focusItem(a.id)} sx={{ borderRadius: 1.5 }}>
                <ListItemText
                  primary={a.name}
                  secondary={ARTICLE_TEMPLATES[a.category].label}
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
