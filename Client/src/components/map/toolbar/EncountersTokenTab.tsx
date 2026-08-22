import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CasinoIcon from '@mui/icons-material/Casino';
import ReplayIcon from '@mui/icons-material/Replay';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useEncounterStore, getEncountersForCampaign } from '../../../store/useEncounterStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../../store/useCreatureStore';
import {
  useRandomEncounterTableStore,
  getRandomEncounterTablesForCampaign,
} from '../../../store/useRandomEncounterTableStore';
import { useTokenManagerUiStore } from '../../../store/useTokenManagerUiStore';
import {
  getEncounterFallbackImage,
  type Encounter,
  type EncounterCreatureEntry,
  type EncounterRollTable,
  type EncounterTableCreature,
} from '../../../types/encounter';
import type { PlacedToken } from '../../../types/token';
import { ENCOUNTER_ENTRY_DRAG_MIME } from '../../../utils/tokenDrag';
import { rollExpression } from '../../../utils/dice';
import { TokenThumbnail } from '../TokenThumbnail';

interface EncountersTokenTabProps {
  campaignId: string;
  placedTokens: PlacedToken[];
  lockedEncounterId: string | null | undefined;
  onLockEncounter: (encounterId: string | null) => void;
  resolvedRoster: EncounterCreatureEntry[] | null;
  onSetResolvedRoster: (roster: EncounterCreatureEntry[] | null) => void;
}

function mobTypesFor(encounter: Encounter, creatures: ReturnType<typeof getCreaturesForCampaign>): string[] {
  const types = encounter.creatures
    .map((entry) => (entry.creatureId ? creatures.find((c) => c.id === entry.creatureId)?.type : undefined))
    .filter((t): t is string => !!t);
  return Array.from(new Set(types));
}

type DieRoll = { total: number; rolls: number[]; expression: string };

function bandLabel(table: EncounterRollTable, index: number): string {
  if (table.minlvl != null || table.maxlvl != null) {
    return `Lv ${table.minlvl ?? 1}-${table.maxlvl ?? 20}`;
  }
  return `Table ${index + 1}`;
}

/** Step 1 of the roll flow: pick/roll which table (if more than one) and which row within it. */
function TableRollStep({
  encounter,
  creatures,
  onConfirm,
}: {
  encounter: Encounter;
  creatures: ReturnType<typeof getCreaturesForCampaign>;
  onConfirm: (row: EncounterRollTable['table'][number]) => void;
}) {
  const tables = encounter.tables ?? [];
  const [bandIndex, setBandIndex] = useState(0);
  const [roll, setRoll] = useState<DieRoll | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const table = tables[bandIndex];

  const rollBand = (t: EncounterRollTable) => {
    const result = rollExpression(t.diceExpression || '1d10');
    setRoll(result);
    const matchIndex = t.table.findIndex((row) => result.total >= row.min && result.total <= row.max);
    setSelectedRow(matchIndex >= 0 ? matchIndex : 0);
  };

  useEffect(() => {
    if (table) rollBand(table);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandIndex, encounter.id]);

  if (!table) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
        This random-table encounter has no tables defined.
      </Typography>
    );
  }

  const suggestedName = (c: EncounterTableCreature) => {
    const match = creatures.find((cr) => cr.name.toLowerCase() === c.name.toLowerCase());
    return match?.name ?? c.name;
  };

  return (
    <Stack spacing={1.5}>
      {tables.length > 1 && (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={bandIndex}
          onChange={(_e, v) => v !== null && setBandIndex(v)}
          sx={{ flexWrap: 'wrap' }}
        >
          {tables.map((t, i) => (
            <ToggleButton key={i} value={i}>
              {bandLabel(t, i)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}

      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CasinoIcon fontSize="small" color="action" />
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            Rolling <strong>{table.diceExpression}</strong>
            {roll && (
              <>
                {' '}
                = <strong>{roll.total}</strong>
              </>
            )}
          </Typography>
          <Tooltip title="Reroll">
            <IconButton size="small" onClick={() => rollBand(table)}>
              <ReplayIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      <Typography variant="caption" color="text.secondary">
        Highlighted result is what was rolled - click any other row to use it instead.
      </Typography>

      <Stack spacing={0.75} sx={{ maxHeight: 260, overflowY: 'auto' }}>
        {table.table.map((row, i) => (
          <Paper
            key={i}
            variant="outlined"
            onClick={() => setSelectedRow(i)}
            sx={{
              p: 1,
              borderRadius: 2,
              cursor: 'pointer',
              borderColor: selectedRow === i ? 'primary.main' : 'divider',
              borderWidth: selectedRow === i ? 2 : 1,
              bgcolor: selectedRow === i ? 'action.selected' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Chip label={row.min === row.max ? row.min : `${row.min}-${row.max}`} size="small" />
              <Typography variant="body2">
                {row.resultText}
                {row.creatures.length > 0 && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {' '}
                    ({row.creatures.map((c) => suggestedName(c)).join(', ')})
                  </Typography>
                )}
              </Typography>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Button
        variant="contained"
        fullWidth
        disabled={selectedRow === null}
        onClick={() => selectedRow !== null && onConfirm(table.table[selectedRow])}
      >
        Next: roll creature counts
      </Button>
    </Stack>
  );
}

/** Step 2 of the roll flow: roll (or hand-edit) how many of each creature named in the row. */
function CreatureCountStep({
  row,
  onBack,
  onConfirm,
}: {
  row: EncounterRollTable['table'][number];
  onBack: () => void;
  onConfirm: (counts: { creature: EncounterTableCreature; count: number; rollLabel: string | null }[]) => void;
}) {
  const [rolls, setRolls] = useState<{ creature: EncounterTableCreature; count: number; rollLabel: string | null }[]>(
    [],
  );

  useEffect(() => {
    setRolls(
      row.creatures.map((creature) => {
        if (creature.countDice) {
          const result = rollExpression(creature.countDice);
          return { creature, count: result.total, rollLabel: creature.countDice };
        }
        return { creature, count: creature.countFixed ?? 1, rollLabel: null };
      }),
    );
  }, [row]);

  const reroll = (index: number) => {
    const entry = rolls[index];
    if (!entry.creature.countDice) return;
    const result = rollExpression(entry.creature.countDice);
    setRolls((prev) => prev.map((r, i) => (i === index ? { ...r, count: result.total } : r)));
  };

  if (rolls.length === 0) {
    return (
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          This result has no named creatures to roll for.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button fullWidth onClick={onBack}>
            Back
          </Button>
          <Button fullWidth variant="contained" onClick={() => onConfirm([])}>
            Finish
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" color="text.secondary">
        {row.resultText}
      </Typography>
      <Stack spacing={1}>
        {rolls.map((entry, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {entry.creature.name}
                {entry.rollLabel && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {' '}
                    (rolling {entry.rollLabel})
                  </Typography>
                )}
              </Typography>
              <TextField
                size="small"
                type="number"
                value={entry.count}
                onChange={(e) =>
                  setRolls((prev) => prev.map((r, ri) => (ri === i ? { ...r, count: Math.max(0, Number(e.target.value)) } : r)))
                }
                sx={{ width: 72 }}
                slotProps={{ htmlInput: { min: 0 } }}
              />
              {entry.rollLabel && (
                <Tooltip title={`Reroll ${entry.rollLabel}`}>
                  <IconButton size="small" onClick={() => reroll(i)}>
                    <ReplayIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>
      <Stack direction="row" spacing={1}>
        <Button fullWidth onClick={onBack}>
          Back
        </Button>
        <Button fullWidth variant="contained" onClick={() => onConfirm(rolls)}>
          Finish
        </Button>
      </Stack>
    </Stack>
  );
}

/** Drives Bugs.txt #4e/4f: select a table row (auto-rolled, overridable), then roll each named
 * creature's count (auto-rolled, editable), then hand off the resolved roster to the normal
 * "left: N, drag to place" view every encounter (fixed or random) already uses. */
function RandomTableRollFlow({
  encounter,
  creatures,
  onResolved,
}: {
  encounter: Encounter;
  creatures: ReturnType<typeof getCreaturesForCampaign>;
  onResolved: (roster: EncounterCreatureEntry[]) => void;
}) {
  const [selectedRow, setSelectedRow] = useState<EncounterRollTable['table'][number] | null>(null);

  if (!selectedRow) {
    return <TableRollStep encounter={encounter} creatures={creatures} onConfirm={setSelectedRow} />;
  }

  return (
    <CreatureCountStep
      row={selectedRow}
      onBack={() => setSelectedRow(null)}
      onConfirm={(counts) => {
        const roster: EncounterCreatureEntry[] = counts
          .filter((c) => c.count > 0)
          .map(({ creature, count }) => {
            const match = creatures.find((cr) => cr.name.toLowerCase() === creature.name.toLowerCase());
            return {
              id: crypto.randomUUID(),
              creatureId: match?.id ?? null,
              name: match?.name ?? creature.name,
              imageSrc: match?.tokenImage ?? '',
              quantity: count,
              size: match ? undefined : 1,
            };
          });
        onResolved(roster);
      }}
    />
  );
}

/** Bugs.txt #4: shown above the search bar only when the campaign has at least one Random
 * Encounter Table (defined in the DM panel's Encounters -> Random Encounters view). Rolling
 * picks an encounter from the table; "Use This Encounter" hands it to the same
 * `onLockEncounter` callback the manual picker below already uses, so the entire
 * locked/roster view (including that encounter's own per-encounter random-table roll, if it
 * has one) works with no further changes - see EncountersTokenTab's locked-encounter branch. */
function RandomEncounterRollBlock({
  campaignId,
  encounters,
  onLockEncounter,
}: {
  campaignId: string;
  encounters: Encounter[];
  onLockEncounter: (encounterId: string | null) => void;
}) {
  const tablesByCampaignId = useRandomEncounterTableStore((s) => s.tablesByCampaignId);
  const fetchTablesForCampaign = useRandomEncounterTableStore((s) => s.fetchTablesForCampaign);
  useEffect(() => {
    fetchTablesForCampaign(campaignId);
  }, [campaignId, fetchTablesForCampaign]);
  const campaignTables = useMemo(
    () => getRandomEncounterTablesForCampaign(tablesByCampaignId, campaignId),
    [tablesByCampaignId, campaignId],
  );

  // Remembers which random table the DM was last rolling against, per campaign, across
  // Manage Tokens popover close/reopen and page reload (client-side UI convenience only).
  const lastEncounterTableIdByCampaignId = useTokenManagerUiStore((s) => s.lastEncounterTableIdByCampaignId);
  const setLastEncounterTableId = useTokenManagerUiStore((s) => s.setLastEncounterTableId);
  const selectedTableId = lastEncounterTableIdByCampaignId[campaignId] ?? null;
  const [roll, setRoll] = useState<DieRoll | null>(null);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (campaignTables.length === 0) return;
    if (!campaignTables.some((t) => t.id === selectedTableId)) {
      setLastEncounterTableId(campaignId, campaignTables[0].id);
      setRoll(null);
      setPickedIndex(null);
    }
  }, [campaignTables, selectedTableId, campaignId, setLastEncounterTableId]);

  if (campaignTables.length === 0) return null;

  const table = campaignTables.find((t) => t.id === selectedTableId) ?? campaignTables[0];

  const doRoll = () => {
    if (table.entries.length === 0) return;
    const result = rollExpression(table.dieExpression);
    const index = ((result.total - 1) % table.entries.length + table.entries.length) % table.entries.length;
    setRoll(result);
    setPickedIndex(index);
  };

  const pickedEntry = pickedIndex !== null ? table.entries[pickedIndex] : null;
  const pickedEncounter = pickedEntry ? encounters.find((e) => e.id === pickedEntry.encounterId) ?? null : null;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CasinoIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
            Random Encounter
          </Typography>
        </Stack>

        {campaignTables.length > 1 && (
          <TextField
            select
            size="small"
            value={table.id}
            onChange={(e) => {
              setLastEncounterTableId(campaignId, e.target.value);
              setRoll(null);
              setPickedIndex(null);
            }}
            slotProps={{ select: { MenuProps: { disablePortal: true } } }}
          >
            {campaignTables.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button size="small" variant="outlined" startIcon={<CasinoIcon fontSize="small" />} onClick={doRoll}>
            Roll {table.dieExpression}
          </Button>
          {roll && (
            <Typography variant="caption" color="text.secondary">
              rolled {roll.total}
            </Typography>
          )}
        </Stack>

        {pickedEncounter && (
          <>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', p: 0.75, borderRadius: 2, bgcolor: 'action.selected' }}
            >
              <TokenThumbnail src={getEncounterFallbackImage(pickedEncounter)} name={pickedEncounter.name} size={32} />
              <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
                {pickedEncounter.name}
              </Typography>
            </Stack>

            {table.entries.length > 1 && (
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {table.entries.map((entry, i) => {
                  const enc = encounters.find((e) => e.id === entry.encounterId);
                  return (
                    <Chip
                      key={entry.id}
                      label={enc?.name ?? 'Unknown'}
                      size="small"
                      color={i === pickedIndex ? 'primary' : 'default'}
                      variant={i === pickedIndex ? 'filled' : 'outlined'}
                      onClick={() => setPickedIndex(i)}
                    />
                  );
                })}
              </Stack>
            )}

            <Stack direction="row" spacing={1}>
              <Button size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={doRoll}>
                Reroll
              </Button>
              <Button size="small" variant="contained" onClick={() => onLockEncounter(pickedEncounter.id)}>
                Use This Encounter
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}

export function EncountersTokenTab({
  campaignId,
  placedTokens,
  lockedEncounterId,
  onLockEncounter,
  resolvedRoster,
  onSetResolvedRoster,
}: EncountersTokenTabProps) {
  const encountersByCampaignId = useEncounterStore((s) => s.encountersByCampaignId);
  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const encounters = getEncountersForCampaign(encountersByCampaignId, campaignId);
  const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);
  const lockedEncounter = lockedEncounterId ? encounters.find((e) => e.id === lockedEncounterId) : null;
  const staleLock = !!lockedEncounterId && !lockedEncounter;

  const [search, setSearch] = useState('');
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [crFilter, setCrFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    // locked encounter was deleted elsewhere - fall back to picker
    if (staleLock) onLockEncounter(null);
  }, [staleLock, onLockEncounter]);

  const rows = useMemo(
    () => encounters.map((encounter) => ({ encounter, mobTypes: mobTypesFor(encounter, creatures) })),
    [encounters, creatures],
  );

  const themeOptions = useMemo(
    () => Array.from(new Set(encounters.map((e) => e.theme).filter(Boolean))).sort(),
    [encounters],
  );
  const crOptions = useMemo(
    () => Array.from(new Set(encounters.map((e) => e.challengeRating).filter(Boolean))).sort(),
    [encounters],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => r.mobTypes))).sort(),
    [rows],
  );

  const filteredRows = rows.filter(({ encounter, mobTypes }) => {
    const query = search.trim().toLowerCase();
    if (query && !encounter.name.toLowerCase().includes(query)) return false;
    if (themeFilter && encounter.theme !== themeFilter) return false;
    if (crFilter && encounter.challengeRating !== crFilter) return false;
    if (typeFilter && !mobTypes.includes(typeFilter)) return false;
    return true;
  });

  const activeFilterCount = [themeFilter, crFilter, typeFilter].filter(Boolean).length;

  if (!lockedEncounter) {
    return (
      <Stack sx={{ maxHeight: 400, overflowY: 'auto', p: 1.5 }} spacing={1}>
        <RandomEncounterRollBlock campaignId={campaignId} encounters={encounters} onLockEncounter={onLockEncounter} />

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search encounters…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
            }}
          />
          <Tooltip title="Filters">
            <IconButton size="small" onClick={(e) => setFilterAnchor(e.currentTarget)} color={activeFilterCount > 0 ? 'primary' : 'default'}>
              <FilterListIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {encounters.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No saved encounters. Add one from the Encounters tab on the DM page.
          </Typography>
        )}
        {encounters.length > 0 && filteredRows.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No encounters match your search/filters.
          </Typography>
        )}
        {filteredRows.map(({ encounter }) => (
          <Stack
            key={encounter.id}
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'center', p: 1, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}
          >
            <TokenThumbnail src={getEncounterFallbackImage(encounter)} name={encounter.name} size={32} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {encounter.name}
                </Typography>
                {encounter.resolutionType === 'random_table' && (
                  <Chip label="Random" size="small" color="secondary" />
                )}
                {encounter.challengeRating && <Chip label={encounter.challengeRating} size="small" variant="outlined" />}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {encounter.resolutionType === 'random_table'
                  ? 'roll to determine creatures'
                  : `${encounter.creatures.reduce((sum, e) => sum + e.quantity, 0)} creatures`}
                {encounter.theme ? ` · ${encounter.theme}` : ''}
              </Typography>
            </Box>
            <Tooltip title="Lock this encounter to the floor">
              <IconButton size="small" onClick={() => onLockEncounter(encounter.id)}>
                <LockOpenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ))}

        <Popover
          open={!!filterAnchor}
          anchorEl={filterAnchor}
          onClose={() => setFilterAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Box sx={{ p: 1.5, width: 240 }}>
            <Typography variant="caption" color="text.secondary">
              Theme
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5, mb: 1.5 }}>
              {themeOptions.length === 0 && <Typography variant="caption" color="text.secondary">None yet</Typography>}
              {themeOptions.map((theme) => (
                <Chip
                  key={theme}
                  label={theme}
                  size="small"
                  color={themeFilter === theme ? 'primary' : 'default'}
                  onClick={() => setThemeFilter(themeFilter === theme ? null : theme)}
                />
              ))}
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Challenge rating
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5, mb: 1.5 }}>
              {crOptions.length === 0 && <Typography variant="caption" color="text.secondary">None yet</Typography>}
              {crOptions.map((cr) => (
                <Chip
                  key={cr}
                  label={cr}
                  size="small"
                  color={crFilter === cr ? 'primary' : 'default'}
                  onClick={() => setCrFilter(crFilter === cr ? null : cr)}
                />
              ))}
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Creature type
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5, mb: 1 }}>
              {typeOptions.length === 0 && <Typography variant="caption" color="text.secondary">None yet</Typography>}
              {typeOptions.map((type) => (
                <Chip
                  key={type}
                  label={type}
                  size="small"
                  color={typeFilter === type ? 'primary' : 'default'}
                  onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                />
              ))}
            </Stack>

            {activeFilterCount > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Button
                  size="small"
                  fullWidth
                  onClick={() => {
                    setThemeFilter(null);
                    setCrFilter(null);
                    setTypeFilter(null);
                  }}
                >
                  Clear filters
                </Button>
              </>
            )}
          </Box>
        </Popover>
      </Stack>
    );
  }

  const isRandom = lockedEncounter.resolutionType === 'random_table';

  if (isRandom && !resolvedRoster) {
    return (
      <Stack sx={{ maxHeight: 460, overflowY: 'auto', p: 1.5 }} spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, flexGrow: 1 }} noWrap>
            {lockedEncounter.name}
          </Typography>
          <Tooltip title="Unlock encounter">
            <Button size="small" startIcon={<LockIcon fontSize="small" />} onClick={() => onLockEncounter(null)}>
              Unlock
            </Button>
          </Tooltip>
        </Stack>
        <RandomTableRollFlow encounter={lockedEncounter} creatures={creatures} onResolved={onSetResolvedRoster} />
      </Stack>
    );
  }

  const roster = isRandom ? (resolvedRoster ?? []) : lockedEncounter.creatures;

  return (
    <Stack sx={{ maxHeight: 400, overflowY: 'auto', p: 1.5 }} spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
          {lockedEncounter.name}
        </Typography>
        {lockedEncounter.challengeRating && <Chip label={lockedEncounter.challengeRating} size="small" variant="outlined" />}
        <Box sx={{ flexGrow: 1 }} />
        {isRandom && (
          <Tooltip title="Roll this encounter again">
            <IconButton size="small" onClick={() => onSetResolvedRoster(null)}>
              <ReplayIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Unlock encounter">
          <Button size="small" startIcon={<LockIcon fontSize="small" />} onClick={() => onLockEncounter(null)}>
            Unlock
          </Button>
        </Tooltip>
      </Stack>
      <Stack spacing={0.5}>
        {roster.map((entry) => {
          const placedCount = placedTokens.filter((t) => t.encounterEntryId === entry.id).length;
          const remaining = entry.quantity - placedCount;
          const draggable = remaining > 0;
          return (
            <Stack
              key={entry.id}
              direction="row"
              spacing={1.5}
              draggable={draggable}
              onDragStart={(e) => {
                if (!draggable) return;
                e.dataTransfer.setData(ENCOUNTER_ENTRY_DRAG_MIME, entry.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              sx={{
                alignItems: 'center',
                p: 1,
                borderRadius: 2,
                cursor: draggable ? 'grab' : 'default',
                opacity: draggable ? 1 : 0.4,
                '&:hover': draggable ? { bgcolor: 'action.hover' } : undefined,
              }}
            >
              {entry.imageSrc ? (
                <Box component="img" src={entry.imageSrc} alt={entry.name} sx={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: 'action.selected',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {entry.name.charAt(0)}
                </Box>
              )}
              <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                {entry.name}
              </Typography>
              <Chip label={`left: ${remaining}`} size="small" color={remaining > 0 ? 'default' : 'default'} variant="outlined" />
            </Stack>
          );
        })}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', pt: 1 }}>
        Drag a creature onto the map to place it.
      </Typography>
    </Stack>
  );
}
