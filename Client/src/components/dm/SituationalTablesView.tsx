import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CasinoIcon from '@mui/icons-material/Casino';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { FilterChipGroup } from './FilterChipGroup';
import { useSituationalTableStore } from '../../store/useSituationalTableStore';
import type { SituationalTable } from '../../types/situationalTable';

function pickRandomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

interface SituationalTableCardProps {
  table: SituationalTable;
}

function SituationalTableCard({ table, highlighted }: SituationalTableCardProps & { highlighted?: boolean }) {
  // columnKey -> rolled entry index. Ephemeral/client-side only, same "fully ephemeral"
  // precedent as the toolbar Dice Roller - nothing here is persisted.
  const [rolled, setRolled] = useState<Record<string, number>>({});

  const rollColumn = (columnKey: string, entriesLength: number) => {
    if (entriesLength === 0) return;
    setRolled((prev) => ({ ...prev, [columnKey]: pickRandomIndex(entriesLength) }));
  };

  const rollAll = () => {
    const next: Record<string, number> = {};
    table.columns.forEach((col) => {
      if (col.entries.length > 0) next[col.key] = pickRandomIndex(col.entries.length);
    });
    setRolled(next);
  };

  const combinedReadout = table.columns
    .map((col) => {
      const idx = rolled[col.key];
      if (idx === undefined) return null;
      return col.entries[idx]?.text ?? null;
    })
    .filter((v): v is string => !!v);

  return (
    <Paper
      id={`situational-table-${table.id}`}
      elevation={2}
      sx={{ p: 3, borderRadius: 3, ...(highlighted ? { outline: '2px solid', outlineColor: 'primary.main' } : {}) }}
    >
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap' }}
      >
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h6">{table.name}</Typography>
            <Chip label={table.theme} size="small" color="primary" variant="outlined" />
          </Stack>
          {table.description && (
            <Typography variant="body2" color="text.secondary">
              {table.description}
            </Typography>
          )}
          {table.source && (
            <Typography variant="caption" color="text.disabled">
              Source: {table.source}
            </Typography>
          )}
        </Stack>
        <Button size="small" variant="outlined" startIcon={<CasinoIcon />} onClick={rollAll}>
          Roll all
        </Button>
      </Stack>

      {combinedReadout.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'action.hover' }}>
          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
            {combinedReadout.join(' — ')}
          </Typography>
        </Paper>
      )}

      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        {table.columns.map((col) => (
          <TableContainer
            key={col.key}
            component={Paper}
            variant="outlined"
            sx={{ flex: '1 1 220px', minWidth: 220 }}
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell colSpan={2}>
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {col.label}
                        {col.dieSize > 0 ? ` (d${col.dieSize})` : ''}
                      </Typography>
                      <Tooltip title={`Roll ${col.label}`}>
                        <IconButton size="small" onClick={() => rollColumn(col.key, col.entries.length)}>
                          <CasinoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {col.entries.map((entry, idx) => {
                  const isRolled = rolled[col.key] === idx;
                  return (
                    <TableRow
                      key={`${col.key}-${entry.roll}-${idx}`}
                      sx={
                        isRolled
                          ? { bgcolor: 'primary.main', '& .MuiTableCell-root': { color: 'primary.contrastText' } }
                          : undefined
                      }
                    >
                      <TableCell sx={{ width: 40 }}>{entry.roll}</TableCell>
                      <TableCell>{entry.text}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ))}
      </Stack>
    </Paper>
  );
}

export function SituationalTablesView() {
  const tables = useSituationalTableStore((s) => s.tables);
  const loaded = useSituationalTableStore((s) => s.loaded);
  const fetchTables = useSituationalTableStore((s) => s.fetchTables);
  const [themeFilter, setThemeFilter] = useState<string[]>([]);
  const [searchParams] = useSearchParams();
  const highlightedId = searchParams.get('table');

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  useEffect(() => {
    if (!highlightedId || !loaded) return;
    document.getElementById(`situational-table-${highlightedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedId, loaded]);

  const themeOptions = useMemo(
    () =>
      Array.from(new Set(tables.map((t) => t.theme)))
        .sort()
        .map((theme) => ({ value: theme, label: theme })),
    [tables],
  );

  const filteredTables = themeFilter.length > 0 ? tables.filter((t) => themeFilter.includes(t.theme)) : tables;

  const toggleTheme = (value: string) => {
    setThemeFilter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Curated roleplay and exploration prompts — roll (or pick) one entry from each column and
        combine them into a scene. Nothing here needs to end in combat.
      </Typography>

      {themeOptions.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <FilterChipGroup label="Theme" options={themeOptions} selected={themeFilter} onToggle={toggleTheme} />
        </Box>
      )}

      {!loaded && tables.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          Loading tables…
        </Typography>
      ) : filteredTables.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
          <TravelExploreIcon sx={{ fontSize: 56, mb: 1, color: 'text.disabled' }} />
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            {themeFilter.length > 0 ? 'No tables match this filter' : 'No roleplay tables yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {themeFilter.length > 0
              ? 'Clear the theme filter to see everything.'
              : 'These are seeded from the reference library — check back after the next data import.'}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={3}>
          {filteredTables.map((table) => (
            <SituationalTableCard key={table.id} table={table} highlighted={table.id === highlightedId} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
