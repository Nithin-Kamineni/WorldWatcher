import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CasinoIcon from '@mui/icons-material/Casino';
import { ItemsSearchFilterBar, type FilterGroupDef } from './ItemsSearchFilterBar';
import { ItemsBrowseSection, BROWSE_PAGE } from './ItemsBrowseSection';
import { PinnableItemRow } from './PinnableItemRow';
import { AllBuilderLaunchers } from './BuilderLaunchers';
import { RollResultView } from '../../dm/randomTables/RollResultView';
import { RandomTableFullView } from '../../dm/randomTables/RandomTableFullView';
import { RandomTableSearchField } from '../../dm/randomTables/RandomTableSearchField';
import {
  buildTableSearchIndex,
  computeCategoryCounts,
  computeTagCounts,
  filterTablesByQuery,
  rankTablesByUsefulness,
  subtreeCategoryIds,
  type TableUsefulnessSignals,
} from '../../dm/randomTables/tableSearch';
import { EMPTY_RANDOM_TABLE_RESULTS, useRandomTableStore } from '../../../store/useRandomTableStore';
import { useCategoryStore, categoryPath } from '../../../store/useCategoryStore';
import { useTagStore } from '../../../store/useTagStore';
import { useTableFormatStore } from '../../../store/useTableFormatStore';
import { usePlayItemsStore, getPlayItemsState, getSlotItems } from '../../../store/usePlayItemsStore';
import { useItemUsageStore, getItemUsage } from '../../../store/useItemUsageStore';
import { useQuickChatSend } from '../../../hooks/useQuickChatSend';
import type { ItemsSurface } from '../layout/playLayoutTrees';
import type { RandomTable, RollResult } from '../../../types/randomTable';
import { thinScrollbarSx, FLOATING_SCROLLBAR_CLASS } from '../../../theme/scrollbarSx';

interface RandomTablesSubWindowProps {
  worldId: string;
  campaignId: string;
  /** Which Items window this is. Every pin/open/expand below is scoped to it, so a second
   * Items window browses tables completely independently of this one. */
  slot: ItemsSurface;
}

/** Random Tables sub-window (issues.txt 10.c.3).
 *
 * Search here is the same counted, everything-at-once search as the Encounters page
 * (RandomTableSearchField over tableSearch.ts): the whole library is loaded once and filtered
 * on the client, so typing is instant, the field always shows how many tables match, and the
 * category/tag facets carry live per-option counts. The previous version debounced a server
 * `q` per keystroke and refused to list anything until something was typed, which is what made
 * it feel broken.
 *
 * An expanded table shows its real structure (RandomTableFullView) plus a roll console, and
 * every rolled result has a one-click "add to chat" so the DM can log what the dice said
 * without retyping it. The three builders (NPC / Place / Encounter) are pinned to the top of
 * the browse list for quick access mid-session. */
export function RandomTablesSubWindow({ worldId, campaignId, slot }: RandomTablesSubWindowProps) {
  const resultKey = `play:${campaignId}`;
  const results = useRandomTableStore((s) => s.resultSets[resultKey]?.results ?? EMPTY_RANDOM_TABLE_RESULTS);
  const searching = useRandomTableStore((s) => s.resultSets[resultKey]?.searching ?? false);
  const ensureSearch = useRandomTableStore((s) => s.ensureSearch);
  const roll = useRandomTableStore((s) => s.roll);
  const details = useRandomTableStore((s) => s.detailById);
  const fetchDetail = useRandomTableStore((s) => s.fetchDetail);

  const categoryFlat = useCategoryStore((s) => s.flat);
  const fetchCategoryTree = useCategoryStore((s) => s.fetchTree);
  const tags = useTagStore((s) => s.tags);
  const fetchTags = useTagStore((s) => s.fetchTags);
  const formats = useTableFormatStore((s) => s.formats);
  const fetchFormats = useTableFormatStore((s) => s.fetchFormats);

  const byCampaignId = usePlayItemsStore((s) => s.byCampaignId);
  const focusItemAction = usePlayItemsStore((s) => s.focusItem);
  const pinItem = usePlayItemsStore((s) => s.pinItem);
  const unpinItem = usePlayItemsStore((s) => s.unpinItem);
  const toggleExpanded = usePlayItemsStore((s) => s.toggleExpanded);
  const slotState = getSlotItems(getPlayItemsState(byCampaignId, campaignId), slot);
  const pinned = slotState.pinnedByKind['random-tables'];
  const current = slotState.currentByKind['random-tables'];
  const expanded = slotState.expandedByKind['random-tables'];

  const usageByCampaignId = useItemUsageStore((s) => s.byCampaignId);
  const recordUse = useItemUsageStore((s) => s.recordUse);
  const recordOpen = useItemUsageStore((s) => s.recordOpen);
  const usage = getItemUsage(usageByCampaignId, campaignId, 'random-tables');

  /** Opening a table is itself a usefulness signal, so every "show me this one" goes through
   * here rather than calling the store action directly. */
  const focusItem = (tableId: string) => {
    recordOpen(campaignId, 'random-tables', tableId);
    focusItemAction(campaignId, slot, 'random-tables', tableId);
  };

  const { canSend, send } = useQuickChatSend(campaignId);

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [limit, setLimit] = useState(BROWSE_PAGE);
  const showMore = useCallback(() => setLimit((n) => n + BROWSE_PAGE), []);
  const [rolling, setRolling] = useState<Record<string, boolean>>({});
  const [rollResults, setRollResults] = useState<Record<string, RollResult>>({});

  useEffect(() => {
    fetchCategoryTree();
    fetchTags();
    fetchFormats();
  }, [fetchCategoryTree, fetchTags, fetchFormats]);

  // One unfiltered load of the *whole* library, shared by every surface on this result key -
  // two Items windows and the map page's Reference sidebar used to fetch it separately, three
  // times over, all writing the same result set (checklist I-U4). Every narrowing below happens
  // on the client,
  // which is what lets the facets show counts instead of only hiding rows. Scope is 'all'
  // rather than this campaign's own_or_global slice so this sub-window searches everything the
  // @-mention picker can offer (useMentionableEntities uses the same scope); a mention of
  // another campaign's homebrew table therefore resolves to a real row here instead of
  // silently opening nothing.
  useEffect(() => {
    void ensureSearch({ scope: 'all', limit: 20000 }, resultKey);
  }, [ensureSearch, resultKey]);

  // A narrowed result set is a fresh list - re-collapse it to the first page.
  useEffect(() => {
    setLimit(BROWSE_PAGE);
  }, [query, categoryFilter, tagFilter]);

  const index = useMemo(() => buildTableSearchIndex(results, categoryFlat, tags), [results, categoryFlat, tags]);

  const categoryScoped = useMemo(() => {
    if (categoryFilter.length === 0) return results;
    const allowed = new Set<string>();
    categoryFilter.forEach((id) => subtreeCategoryIds(categoryFlat, id)?.forEach((child) => allowed.add(child)));
    return results.filter((table) => table.categoryId && allowed.has(table.categoryId));
  }, [results, categoryFilter, categoryFlat]);

  const tagScoped = useMemo(
    () => (tagFilter.length === 0 ? results : results.filter((table) => table.tagIds.some((id) => tagFilter.includes(id)))),
    [results, tagFilter],
  );

  const scoped = useMemo(
    () => (tagFilter.length === 0 ? categoryScoped : categoryScoped.filter((table) => table.tagIds.some((id) => tagFilter.includes(id)))),
    [categoryScoped, tagFilter],
  );

  // Facet counts exclude their own facet (the usual faceted-search rule) so a count answers
  // "how many would I get if I picked this", not "how many are left after what I already picked".
  const categoryCounts = useMemo(() => computeCategoryCounts(filterTablesByQuery(tagScoped, query, index), categoryFlat), [tagScoped, query, index, categoryFlat]);
  const tagCounts = useMemo(() => computeTagCounts(filterTablesByQuery(categoryScoped, query, index)), [categoryScoped, query, index]);

  // Ranked, not alphabetised: what the DM has actually rolled and pinned in this campaign
  // decides the order, with the typed query dominating once there is one (see
  // rankTablesByUsefulness). Alphabetical order here was the complaint - it buried the tables
  // that get used every session under whatever happened to start with an "A".
  const usefulness: TableUsefulnessSignals = useMemo(
    () => ({ usage, pinnedIds: pinned, campaignId }),
    [usage, pinned, campaignId],
  );

  const matched = useMemo(
    () => rankTablesByUsefulness(filterTablesByQuery(scoped, query, index), query, usefulness),
    [scoped, query, index, usefulness],
  );

  const groups: FilterGroupDef[] = useMemo(
    () => [
      {
        key: 'category',
        label: 'Category',
        options: categoryFlat
          .filter((category) => (categoryCounts.get(category.id) ?? 0) > 0 || categoryFilter.includes(category.id))
          .sort((a, b) => (categoryCounts.get(b.id) ?? 0) - (categoryCounts.get(a.id) ?? 0) || a.name.localeCompare(b.name))
          .map((category) => ({ value: category.id, label: `${category.name} (${categoryCounts.get(category.id) ?? 0})` })),
      },
      {
        key: 'tag',
        label: 'Tag',
        options: tags
          .filter((tag) => (tagCounts.get(tag.id) ?? 0) > 0 || tagFilter.includes(tag.id))
          .sort((a, b) => (tagCounts.get(b.id) ?? 0) - (tagCounts.get(a.id) ?? 0) || a.label.localeCompare(b.label))
          .map((tag) => ({ value: tag.id, label: `${tag.label || `${tag.namespace}:${tag.value}`} (${tagCounts.get(tag.id) ?? 0})` })),
      },
    ],
    [categoryFlat, categoryCounts, categoryFilter, tags, tagCounts, tagFilter],
  );

  const categoryLabel = (categoryId: string | null): string => categoryPath(categoryFlat, categoryId) || 'Uncategorized';
  const formatName = (formatId: string): string => formats.find((f) => f.id === formatId)?.name ?? 'Table';
  const taglineFor = (table: RandomTable): string => `${categoryLabel(table.categoryId)} · ${formatName(table.formatId)}`;

  const displayIds = [...pinned, ...(current && !pinned.includes(current) ? [current] : [])];
  // A pinned/opened table is resolved from the loaded library first and from its own fetched
  // detail second (RandomTableDetail extends RandomTable), so opening one that the library load
  // does not carry - a stale pin, a table created elsewhere this session - still renders a row
  // rather than nothing at all.
  const displayTables = displayIds
    .map((id) => results.find((t) => t.id === id) ?? details[id])
    .filter((t): t is RandomTable => !!t);

  // Expanded rows render the table's real structure, which only the detail endpoint carries -
  // and an id the library load missed needs that same call just to know the table's name.
  useEffect(() => {
    displayIds.forEach((id) => {
      const known = results.some((t) => t.id === id);
      if ((expanded.includes(id) || !known) && !details[id]) void fetchDetail(id);
    });
    // displayIds/expanded are derived arrays - identity changes every render, so depend on the
    // stable string form instead of re-running the fetch loop constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayIds.join(','), expanded.join(','), results, details, fetchDetail]);

  // Opening a table puts its row at the top of this pane - which is off-screen if the DM was
  // scrolled down the browse list, making the click look like it did nothing. Scroll back up
  // whenever the opened table changes so the row it opened is what you are looking at.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (current) scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current]);

  const rollTable = async (tableId: string) => {
    setRolling((prev) => ({ ...prev, [tableId]: true }));
    const result = await roll(tableId);
    setRolling((prev) => ({ ...prev, [tableId]: false }));
    if (result) {
      setRollResults((prev) => ({ ...prev, [tableId]: result }));
      recordUse(campaignId, 'random-tables', tableId);
    }
    return result;
  };

  const rollFromBrowse = async (tableId: string) => {
    focusItem(tableId);
    await rollTable(tableId);
  };

  const hasNarrowing = query.trim() !== '' || categoryFilter.length > 0 || tagFilter.length > 0;
  const visible = matched.slice(0, limit);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ItemsSearchFilterBar
        search={query}
        onSearchChange={setQuery}
        groups={groups}
        selected={{ category: categoryFilter, tag: tagFilter }}
        onToggle={(key, value) => {
          const setter = key === 'category' ? setCategoryFilter : setTagFilter;
          setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
        }}
        onClear={() => {
          setCategoryFilter([]);
          setTagFilter([]);
        }}
        searchSlot={
          <RandomTableSearchField
            dense
            value={query}
            onChange={setQuery}
            tables={scoped}
            index={index}
            flatCategories={categoryFlat}
            tags={tags}
            placeholder="Search tables, categories, tags..."
            onPickTable={(table) => focusItem(table.id)}
            usefulness={usefulness}
            onPickCategory={(id) => setCategoryFilter((prev) => (prev.includes(id) ? prev : [...prev, id]))}
            onPickTag={(id) => setTagFilter((prev) => (prev.includes(id) ? prev : [...prev, id]))}
          />
        }
      />
      {searching && results.length === 0 && <LinearProgress />}

      <Box ref={scrollRef} className={FLOATING_SCROLLBAR_CLASS} sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0, px: 1.25, pb: 1, ...thinScrollbarSx }}>
        {displayTables.length > 0 && (
          <Stack spacing={0} sx={{ mb: 1.5 }}>
            {displayTables.map((table) => {
              const isExpanded = expanded.includes(table.id);
              const isPinned = pinned.includes(table.id);
              const isRolling = !!rolling[table.id];
              const result = rollResults[table.id];
              const detail = details[table.id];
              return (
                <PinnableItemRow
                  key={table.id}
                  icon={<CasinoIcon fontSize="small" color="action" />}
                  title={table.name}
                  tagline={taglineFor(table)}
                  pinned={isPinned}
                  onTogglePin={() => (isPinned ? unpinItem(campaignId, slot, 'random-tables', table.id) : pinItem(campaignId, slot, 'random-tables', table.id))}
                  expanded={isExpanded}
                  onToggleExpand={() => toggleExpanded(campaignId, slot, 'random-tables', table.id)}
                  onOpenNewTab={() => window.open(`/w/${worldId}/c/${campaignId}/tables?table=${table.id}`, '_blank')}
                >
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={isRolling ? <CircularProgress size={14} color="inherit" /> : <CasinoIcon sx={{ fontSize: 17 }} />}
                        disabled={isRolling}
                        onClick={() => void rollTable(table.id)}
                      >
                        {result ? 'Roll again' : 'Roll'}
                      </Button>
                    </Stack>

                    {result ? (
                      <>
                        <RollResultView result={result} onSendToChat={canSend ? send : undefined} />
                        {!canSend && (
                          <Typography variant="caption" color="text.secondary">
                            Start a chat thread for this session to log rolls in one click.
                          </Typography>
                        )}
                      </>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Roll to see a result - the full table is below.
                      </Typography>
                    )}

                    <Divider flexItem />
                    <Typography variant="overline" color="text.secondary">
                      Table
                    </Typography>
                    {detail ? (
                      <Box className={FLOATING_SCROLLBAR_CLASS} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5, ...thinScrollbarSx }}>
                        <RandomTableFullView table={detail} compact />
                      </Box>
                    ) : (
                      <LinearProgress />
                    )}
                  </Stack>
                </PinnableItemRow>
              );
            })}
          </Stack>
        )}

        {/* The builders are a standing-start convenience, not something to scroll past mid-
            search - while a query/filter is narrowing the list, the matches sit directly under
            the search bar instead. */}
        {!hasNarrowing && <AllBuilderLaunchers worldId={worldId} campaignId={campaignId} slot={slot} />}

        <ItemsBrowseSection
          matched={matched.length}
          total={results.length}
          narrowed={hasNarrowing}
          noun="tables"
          emptyLabel={searching ? 'Loading the table library…' : 'No tables in this campaign yet.'}
          limit={limit}
          onShowMore={showMore}
        >
          <List dense disablePadding>
            {visible.map((t) => (
              <ListItemButton
                key={t.id}
                onClick={() => focusItem(t.id)}
                sx={{ borderRadius: 1.5, pr: 0.5 }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </Box>
                      {t.isSystem && <Chip label="system" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.6rem', flexShrink: 0 }} />}
                    </Stack>
                  }
                  secondary={taglineFor(t)}
                  slotProps={{ primary: { sx: { fontSize: 13.5 } }, secondary: { sx: { fontSize: 11.5 } } }}
                />
                <Tooltip title="Roll this table now">
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      void rollFromBrowse(t.id);
                    }}
                  >
                    {rolling[t.id] ? <CircularProgress size={15} /> : <CasinoIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </ListItemButton>
            ))}
          </List>
        </ItemsBrowseSection>
      </Box>
    </Box>
  );
}
