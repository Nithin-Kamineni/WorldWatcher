import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { ItemsSearchFilterBar, type FilterGroupDef } from './ItemsSearchFilterBar';
import { PinnableItemRow } from './PinnableItemRow';
import { PlaceBuilderLauncher } from './BuilderLaunchers';
import { getArticleCategoryIcon } from '../../world/articleIcons';
import { useArticleStore, getArticlesForWorld } from '../../../store/useArticleStore';
import { usePlayItemsStore, getPlayItemsState, getSlotItems } from '../../../store/usePlayItemsStore';
import type { PaneSlot } from '../layout/playLayoutTrees';
import { ARTICLE_TEMPLATES, getArticleTemplatesByGroup } from '../../../types/article';
import { thinScrollbarSx, FLOATING_SCROLLBAR_CLASS } from '../../../theme/scrollbarSx';

interface PlacesSubWindowProps {
  worldId: string;
  campaignId: string;
  /** Which Items window this is - all pin/open/expand state below is scoped to it. */
  slot: PaneSlot;
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
  const focusItem = usePlayItemsStore((s) => s.focusItem);
  const pinItem = usePlayItemsStore((s) => s.pinItem);
  const unpinItem = usePlayItemsStore((s) => s.unpinItem);
  const toggleExpanded = usePlayItemsStore((s) => s.toggleExpanded);
  const slotState = getSlotItems(getPlayItemsState(byCampaignId, campaignId), slot);
  const pinned = slotState.pinnedByKind.places;
  const current = slotState.currentByKind.places;
  const expanded = slotState.expandedByKind.places;

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

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

  const filtered = !hasQuery
    ? []
    : places.filter((a) => {
        if (categoryFilter.length > 0 && !categoryFilter.includes(a.category)) return false;
        if (!search.trim()) return true;
        return a.name.toLowerCase().includes(search.trim().toLowerCase());
      });

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
                  onToggleExpand={() => toggleExpanded(campaignId, slot, 'places', place.id)}
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

        <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>
          Browse
        </Typography>
        {!hasQuery ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            Search or filter to browse places.
          </Typography>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No places match.
          </Typography>
        ) : (
          <List dense disablePadding>
            {filtered.map((a) => (
              <ListItemButton key={a.id} onClick={() => focusItem(campaignId, slot, 'places', a.id)} sx={{ borderRadius: 1.5 }}>
                <ListItemText
                  primary={a.name}
                  secondary={ARTICLE_TEMPLATES[a.category].label}
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
