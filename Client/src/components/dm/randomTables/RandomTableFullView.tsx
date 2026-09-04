import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import CasinoOutlinedIcon from '@mui/icons-material/CasinoOutlined';
import LinkIcon from '@mui/icons-material/Link';
import NotesIcon from '@mui/icons-material/Notes';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { StructuredContent } from '../StructuredContent';
import { rangeProbability, weightProbability, formatProbability } from './diceProbability';
import { useCategoryStore, categoryPath } from '../../../store/useCategoryStore';
import { useTagStore } from '../../../store/useTagStore';
import { useTableFormatStore } from '../../../store/useTableFormatStore';
import type { RandomTableDetail, TableEntry } from '../../../types/randomTable';

interface RandomTableFullViewProps {
  table: RandomTableDetail;
  compact?: boolean;
  onOpenEncounter?: (encounterId: string) => void;
}

function rangeLabel(entry: TableEntry, weighted: boolean, grid: boolean, positionalIndex?: number): string {
  if (grid) {
    const first = entry.min === entry.max ? `${entry.min ?? '—'}` : `${entry.min ?? '—'}–${entry.max ?? '—'}`;
    const second = entry.secondaryMin === entry.secondaryMax
      ? `${entry.secondaryMin ?? '—'}`
      : `${entry.secondaryMin ?? '—'}–${entry.secondaryMax ?? '—'}`;
    return `${first} × ${second}`;
  }
  if (weighted) return `${entry.weight ?? 0}`;
  if (positionalIndex !== undefined) return `${positionalIndex + 1}`;
  if (entry.min === null && entry.max === null) return '—';
  return entry.min === entry.max ? `${entry.min}` : `${entry.min ?? '—'}–${entry.max ?? '—'}`;
}

function entryText(entry: TableEntry): string {
  if (entry.text?.trim()) return entry.text;
  if (entry.refHydrated?.name) return entry.refHydrated.name;
  if (entry.kind === 'encounter_ref') return entry.encounterId ? 'Encounter unavailable' : 'Encounter details need migration';
  if (entry.kind === 'table_ref') return 'Unavailable nested table';
  if (entry.kind === 'creature_ref') return 'Unavailable creature';
  if (entry.kind === 'npc_ref') return 'Unavailable NPC';
  if (entry.kind === 'item_ref') return 'Unavailable magic item';
  if (entry.bundle && typeof entry.bundle === 'object') return JSON.stringify(entry.bundle);
  return 'Empty result';
}

function entryReferenceDetails(entry: TableEntry): string | null {
  const ref = entry.refHydrated;
  if (!ref) return null;
  const details = [ref.primary_type, ref.creature_type, ref.difficulty, ref.description]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return details.length > 0 ? details.slice(0, 2).join(' · ') : null;
}

function kindLabel(kind: TableEntry['kind']): string {
  return {
    text: 'Text',
    encounter_ref: 'Encounter',
    table_ref: 'Nested table',
    creature_ref: 'Creature',
    npc_ref: 'NPC',
    item_ref: 'Magic item',
  }[kind];
}

export function RandomTableFullView({ table, compact = false, onOpenEncounter }: RandomTableFullViewProps) {
  const categories = useCategoryStore((s) => s.flat);
  const tags = useTagStore((s) => s.tags);
  const formats = useTableFormatStore((s) => s.formats);
  const format = formats.find((item) => item.id === table.formatId);
  const weighted = ['weighted_pool', 'deck', 'countdown_deck'].includes(format?.slug ?? '');
  const grid = format?.slug === 'grid';

  return (
    <Stack spacing={compact ? 1.5 : 2.5}>
      {!compact && (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: 3,
            background: (theme) =>
              `linear-gradient(135deg, ${theme.palette.primary.main}18 0%, transparent 58%)`,
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
            <Box>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{table.name}</Typography>
                {format && <Chip size="small" color="primary" variant="outlined" label={format.name} />}
                <Chip size="small" variant="outlined" label={table.isSystem ? 'Curated' : 'Homebrew'} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {categoryPath(categories, table.categoryId) || 'Uncategorized'}
              </Typography>
              {table.description && (
                <Typography variant="body2" sx={{ mt: 1, maxWidth: 760 }}>{table.description}</Typography>
              )}
            </Box>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexShrink: 0 }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">Structure</Typography>
                <Typography variant="subtitle2">{table.columns.length} column{table.columns.length === 1 ? '' : 's'} · {table.columns.reduce((sum, column) => sum + column.entries.length, 0)} results</Typography>
              </Box>
              <CasinoOutlinedIcon color="primary" sx={{ fontSize: 32 }} />
            </Stack>
          </Stack>

          {table.tagIds.length > 0 && (
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.5 }}>
              {table.tagIds.map((id) => {
                const tag = tags.find((item) => item.id === id);
                return tag ? <Chip key={id} size="small" label={`${tag.namespace}:${tag.value}`} sx={{ borderRadius: 1.5 }} /> : null;
              })}
            </Stack>
          )}
        </Paper>
      )}

      {(table.triggerSituation || table.combineTemplate || table.sourceBook) && (
        <Stack spacing={1} divider={<Divider flexItem />}>
          {table.triggerSituation && (
            <Stack direction="row" spacing={1.25}>
              <CasinoOutlinedIcon fontSize="small" color="action" />
              <Box><Typography variant="caption" color="text.secondary">Roll when</Typography><Typography variant="body2">{table.triggerSituation}</Typography></Box>
            </Stack>
          )}
          {table.combineTemplate && (
            <Stack direction="row" spacing={1.25}>
              <NotesIcon fontSize="small" color="action" />
              <Box><Typography variant="caption" color="text.secondary">Combine template</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{table.combineTemplate}</Typography></Box>
            </Stack>
          )}
          {table.sourceBook && (
            <Stack direction="row" spacing={1.25}>
              <LinkIcon fontSize="small" color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary">Source</Typography>
                {table.sourceBook.toLowerCase().includes('5etools') ? (
                  <Link href="https://5e.tools/encounters.html" target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem' }}>
                    {table.sourceBook}<OpenInNewIcon sx={{ fontSize: 15 }} />
                  </Link>
                ) : <Typography variant="body2">{table.sourceBook}</Typography>}
              </Box>
            </Stack>
          )}
        </Stack>
      )}

      {table.columns.map((column) => {
        const totalWeight = column.entries.reduce((sum, entry) => sum + (entry.weight ?? 0), 0);
        const positional = column.entries.length > 0 && column.entries.every((entry) => entry.min === null && entry.max === null);
        const positionalCount = positional ? Math.min(column.dieSides > 0 ? column.dieSides : column.entries.length, column.entries.length) : 0;
        const inferredSides = column.dieSides > 0 ? column.dieSides : Math.max(1, ...column.entries.map((entry) => entry.max ?? 0));
        const die = positional
          ? `1d${positionalCount}`
          : `${column.dieCount}d${inferredSides}${column.dieModifier === 0 ? '' : column.dieModifier > 0 ? `+${column.dieModifier}` : column.dieModifier}`;
        const encounterColumn = column.entries.some((entry) => entry.kind === 'encounter_ref');
        return (
          <Paper key={column.id} variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Stack
              direction="row"
              sx={{
                px: compact ? 1.5 : 2,
                py: 1.25,
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: 'action.hover',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{column.name}</Typography>
              <Chip size="small" color="primary" icon={<CasinoOutlinedIcon />} label={die} sx={{ fontFamily: 'monospace', fontWeight: 800 }} />
            </Stack>
            <TableContainer sx={{ maxHeight: compact ? 'none' : 520 }}>
              <Table size="small" stickyHeader={!compact} aria-label={`${column.name} random table`}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: grid ? 110 : 80, fontWeight: 800 }}>{weighted ? 'Weight' : grid ? 'Coordinates' : 'Roll'}</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>{encounterColumn ? 'Encounter' : 'Result'}</TableCell>
                    {encounterColumn && <TableCell sx={{ fontWeight: 800 }}>CR</TableCell>}
                    {encounterColumn && <TableCell sx={{ fontWeight: 800, minWidth: 180 }}>Creatures</TableCell>}
                    {encounterColumn && <TableCell sx={{ fontWeight: 800 }}>Pillar</TableCell>}
                    {encounterColumn && <TableCell align="right" sx={{ fontWeight: 800 }}>XP</TableCell>}
                    {!encounterColumn && !compact && <TableCell sx={{ width: 110, fontWeight: 800 }}>Type</TableCell>}
                    {!encounterColumn && !compact && <TableCell align="right" sx={{ width: 88, fontWeight: 800 }}>Odds</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {column.entries.map((entry, index) => {
                    const probability = weighted
                      ? weightProbability(entry.weight, totalWeight)
                      : grid
                        ? null
                        : positional
                          ? (index < positionalCount ? 1 / positionalCount : 0)
                          : rangeProbability(column.dieCount, inferredSides, column.dieModifier, entry.min, entry.max);
                    const referenceDetails = entryReferenceDetails(entry);
                    return (
                      <TableRow
                        key={entry.id}
                        hover
                        tabIndex={entry.kind === 'encounter_ref' && entry.encounterId && onOpenEncounter ? 0 : undefined}
                        onClick={entry.kind === 'encounter_ref' && entry.encounterId && onOpenEncounter ? () => onOpenEncounter(entry.encounterId as string) : undefined}
                        onKeyDown={entry.kind === 'encounter_ref' && entry.encounterId && onOpenEncounter ? (event) => { if (event.key === 'Enter' || event.key === ' ') onOpenEncounter(entry.encounterId as string); } : undefined}
                        sx={{ '&:nth-of-type(even)': { bgcolor: 'action.hover' }, cursor: entry.kind === 'encounter_ref' && entry.encounterId && onOpenEncounter ? 'pointer' : 'default' }}
                      >
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 800, color: 'primary.main' }}>{rangeLabel(entry, weighted, grid, positional ? index : undefined)}</TableCell>
                        <TableCell>
                          <StructuredContent value={entry.bundle ?? entryText(entry)} />
                          {!encounterColumn && referenceDetails && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{referenceDetails}</Typography>}
                          {entry.notes && <Typography variant="caption" color="text.secondary">{entry.notes}</Typography>}
                        </TableCell>
                        {encounterColumn && <TableCell>{String(entry.refHydrated?.challenge_rating ?? entry.refHydrated?.difficulty ?? '—')}</TableCell>}
                        {encounterColumn && <TableCell><Typography variant="body2">{String(entry.refHydrated?.creature_count ?? '—')}</Typography>{Array.isArray(entry.refHydrated?.creature_types) && <Typography variant="caption" color="text.secondary">{entry.refHydrated.creature_types.join(', ')}</Typography>}</TableCell>}
                        {encounterColumn && <TableCell><Chip size="small" variant="outlined" label={String(entry.refHydrated?.primary_type ?? 'Unclassified')} /></TableCell>}
                        {encounterColumn && <TableCell align="right">{typeof entry.refHydrated?.xp === 'number' ? entry.refHydrated.xp.toLocaleString() : '—'}</TableCell>}
                        {!encounterColumn && !compact && <TableCell><Chip size="small" variant="outlined" label={kindLabel(entry.kind)} /></TableCell>}
                        {!encounterColumn && !compact && <TableCell align="right"><Typography variant="caption" color="text.secondary">{probability === null ? (index + 1).toString().padStart(2, '0') : formatProbability(probability)}</Typography></TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        );
      })}
    </Stack>
  );
}
