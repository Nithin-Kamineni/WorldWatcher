import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Paper from '@mui/material/Paper';
import CasinoIcon from '@mui/icons-material/Casino';
import { ItemsSearchFilterBar, type FilterGroupDef } from './ItemsSearchFilterBar';
import { PinnableItemRow } from './PinnableItemRow';
import { useSituationalTableStore } from '../../../store/useSituationalTableStore';
import { usePlayItemsStore } from '../../../store/usePlayItemsStore';
import { thinScrollbarSx, FLOATING_SCROLLBAR_CLASS } from '../../../theme/scrollbarSx';

interface RandomTablesSubWindowProps {
  worldId: string;
  campaignId: string;
}

function pickRandomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

/** Random Tables sub-window (issues.txt 10.c.3) - browse/search+filter at top, then a pinned +
 * one "current" list of tables shown collapsed-by-default with a roll-ready expanded view.
 * Reworks the original RandomTablesPanel.tsx onto the shared pin/collapse shell. */
export function RandomTablesSubWindow({ worldId, campaignId }: RandomTablesSubWindowProps) {
  const tables = useSituationalTableStore((s) => s.tables);
  const loaded = useSituationalTableStore((s) => s.loaded);
  const fetchTables = useSituationalTableStore((s) => s.fetchTables);

  const byCampaignId = usePlayItemsStore((s) => s.byCampaignId);
  const selectItem = usePlayItemsStore((s) => s.selectItem);
  const pinItem = usePlayItemsStore((s) => s.pinItem);
  const unpinItem = usePlayItemsStore((s) => s.unpinItem);
  const toggleExpanded = usePlayItemsStore((s) => s.toggleExpanded);
  const campaignState = byCampaignId[campaignId];
  const pinned = campaignState?.pinnedByKind['random-tables'] ?? [];
  const current = campaignState?.currentByKind['random-tables'] ?? null;
  const expanded = campaignState?.expandedByKind['random-tables'] ?? [];

  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState<string[]>([]);
  const [rolled, setRolled] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const themeGroup: FilterGroupDef[] = useMemo(
    () => [
      {
        key: 'theme',
        label: 'Theme',
        options: Array.from(new Set(tables.map((t) => t.theme))).sort().map((theme) => ({ value: theme, label: theme })),
      },
    ],
    [tables],
  );

  const hasQuery = search.trim() !== '' || themeFilter.length > 0;

  const filtered = !hasQuery
    ? []
    : tables.filter((t) => {
        if (themeFilter.length > 0 && !themeFilter.includes(t.theme)) return false;
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return t.name.toLowerCase().includes(q) || t.theme.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q));
      });

  const displayIds = [...pinned, ...(current && !pinned.includes(current) ? [current] : [])];
  const displayTables = displayIds.map((id) => tables.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t);

  const rollColumn = (tableId: string, columnKey: string, entriesLength: number) => {
    if (entriesLength === 0) return;
    setRolled((prev) => ({ ...prev, [tableId]: { ...prev[tableId], [columnKey]: pickRandomIndex(entriesLength) } }));
  };
  const rollAll = (tableId: string, columns: { key: string; entries: unknown[] }[]) => {
    const next: Record<string, number> = {};
    columns.forEach((col) => {
      if (col.entries.length > 0) next[col.key] = pickRandomIndex(col.entries.length);
    });
    setRolled((prev) => ({ ...prev, [tableId]: next }));
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ItemsSearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tables…"
        groups={themeGroup}
        selected={{ theme: themeFilter }}
        onToggle={(_key, value) => setThemeFilter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))}
        onClear={() => setThemeFilter([])}
      />

      <Box className={FLOATING_SCROLLBAR_CLASS} sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0, px: 1.25, pb: 1, ...thinScrollbarSx }}>
        {displayTables.length > 0 && (
          <Stack spacing={0} sx={{ mb: 1.5 }}>
            {displayTables.map((table) => {
              const isExpanded = expanded.includes(table.id);
              const isPinned = pinned.includes(table.id);
              return (
                <PinnableItemRow
                  key={table.id}
                  icon={<CasinoIcon fontSize="small" color="action" />}
                  title={table.name}
                  tagline={`${table.theme} · ${table.columns.length} column${table.columns.length === 1 ? '' : 's'}`}
                  pinned={isPinned}
                  onTogglePin={() => (isPinned ? unpinItem(campaignId, 'random-tables', table.id) : pinItem(campaignId, 'random-tables', table.id))}
                  expanded={isExpanded}
                  onToggleExpand={() => toggleExpanded(campaignId, 'random-tables', table.id)}
                  onOpenNewTab={() => window.open(`/w/${worldId}/c/${campaignId}/encounters?view=situational_tables&table=${table.id}`, '_blank')}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                      <IconButton size="small" onClick={() => rollAll(table.id, table.columns)}>
                        <CasinoIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    {table.columns.map((col) => {
                      const idx = rolled[table.id]?.[col.key];
                      return (
                        <Paper key={col.key} variant="outlined" sx={{ borderRadius: 1.25, overflow: 'hidden' }}>
                          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 1.25, py: 0.6, bgcolor: 'action.hover' }}>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {col.label}
                              {col.dieSize > 0 ? ` (d${col.dieSize})` : ''}
                            </Typography>
                            <IconButton size="small" onClick={() => rollColumn(table.id, col.key, col.entries.length)}>
                              <CasinoIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                          <Box className={FLOATING_SCROLLBAR_CLASS} sx={{ maxHeight: 140, overflowY: 'auto', ...thinScrollbarSx }}>
                            <Table size="small">
                              <TableBody>
                                {col.entries.map((entry, i) => (
                                  <TableRow key={`${col.key}-${i}`} sx={idx === i ? { bgcolor: 'primary.main', '& .MuiTableCell-root': { color: 'primary.contrastText' } } : undefined}>
                                    <TableCell sx={{ width: 28, py: 0.4 }}>{entry.roll}</TableCell>
                                    <TableCell sx={{ py: 0.4, fontSize: 12.5 }}>{entry.text}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        </Paper>
                      );
                    })}
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
            Search or filter to browse tables.
          </Typography>
        ) : !loaded && tables.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            Loading…
          </Typography>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No tables match.
          </Typography>
        ) : (
          <List dense disablePadding>
            {filtered.map((t) => (
              <ListItemButton key={t.id} onClick={() => selectItem(campaignId, 'random-tables', t.id)} sx={{ borderRadius: 1.5 }}>
                <ListItemText
                  primary={t.name}
                  secondary={`${t.theme} · ${t.columns.length} column${t.columns.length === 1 ? '' : 's'}`}
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
