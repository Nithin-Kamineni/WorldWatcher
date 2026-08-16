import { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import TuneIcon from '@mui/icons-material/Tune';
import CalculateIcon from '@mui/icons-material/Calculate';
import CasinoIcon from '@mui/icons-material/Casino';
import {
  ENCOUNTER_LOCATION_PRESETS,
  ENCOUNTER_THEME_PRESETS,
  ENCOUNTER_TYPE_PRESETS,
  type Encounter,
  type EncounterCreatureEntry,
  type EncounterResolutionType,
  type EncounterRollTable,
  type EncounterTableCreature,
  type EncounterTableRow,
} from '../../types/encounter';
import type { Creature } from '../../types/creature';
import { suggestEncounterDifficulty } from '../../utils/encounterCalculator';

interface EncounterFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (encounter: Encounter) => void;
  initialEncounter?: Encounter;
  creatures: Creature[];
}

function emptyState() {
  return {
    name: '',
    description: '',
    challengeRating: '',
    theme: '',
    encounterType: '',
    possibleLocations: [] as string[],
    tags: [] as string[],
    creatures: [] as EncounterCreatureEntry[],
    resolutionType: 'fixed' as EncounterResolutionType,
    page: '' as string,
    tables: [] as EncounterRollTable[],
  };
}

function emptyTableRow(): EncounterTableRow {
  return { min: 1, max: 1, result: '', resultText: '', creatures: [] };
}

function emptyRollTable(): EncounterRollTable {
  return { diceExpression: '1d10', minlvl: null, maxlvl: null, table: [emptyTableRow()] };
}

function emptyTableCreature(): EncounterTableCreature {
  return { name: '', source: null, countDice: null, countFixed: 1 };
}

function stateFromEncounter(encounter: Encounter) {
  return {
    name: encounter.name,
    description: encounter.description,
    challengeRating: encounter.challengeRating,
    theme: encounter.theme,
    encounterType: encounter.encounterType ?? '',
    possibleLocations: encounter.possibleLocations ?? [],
    tags: encounter.tags,
    creatures: encounter.creatures,
    resolutionType: encounter.resolutionType ?? 'fixed',
    page: encounter.page != null ? String(encounter.page) : '',
    tables: encounter.tables ?? [],
  };
}

export function EncounterFormDialog({ open, onClose, onSubmit, initialEncounter, creatures }: EncounterFormDialogProps) {
  const isEditMode = !!initialEncounter;
  const [state, setState] = useState(emptyState());
  const [customName, setCustomName] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setState(initialEncounter ? stateFromEncounter(initialEncounter) : emptyState());
    setCustomName('');
    setMoreOpen(false);
  }, [open, initialEncounter]);

  const set = <K extends keyof ReturnType<typeof emptyState>>(key: K, value: ReturnType<typeof emptyState>[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const addCreature = (creature: Creature) => {
    const existing = state.creatures.find((e) => e.creatureId === creature.id);
    if (existing) {
      set(
        'creatures',
        state.creatures.map((e) => (e.id === existing.id ? { ...e, quantity: e.quantity + 1 } : e)),
      );
      return;
    }
    set('creatures', [
      ...state.creatures,
      { id: crypto.randomUUID(), creatureId: creature.id, name: creature.name, imageSrc: creature.tokenImage, quantity: 1 },
    ]);
  };

  const addCustomCreature = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    set('creatures', [
      ...state.creatures,
      { id: crypto.randomUUID(), creatureId: null, name: trimmed, imageSrc: '', quantity: 1 },
    ]);
    setCustomName('');
  };

  const updateQuantity = (entryId: string, delta: number) => {
    set(
      'creatures',
      state.creatures
        .map((e) => (e.id === entryId ? { ...e, quantity: Math.max(1, e.quantity + delta) } : e))
        .filter((e) => e.quantity > 0),
    );
  };

  const removeEntry = (entryId: string) => {
    set('creatures', state.creatures.filter((e) => e.id !== entryId));
  };

  const suggestion = useMemo(
    () => suggestEncounterDifficulty(state.creatures, creatures),
    [state.creatures, creatures],
  );

  const applySuggestion = () => set('challengeRating', suggestion.label);

  const isValid = state.name.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const now = Date.now();
    const parsedPage = parseInt(state.page, 10);
    const encounter: Encounter = {
      id: initialEncounter?.id ?? crypto.randomUUID(),
      name: state.name.trim(),
      description: state.description.trim(),
      challengeRating: state.challengeRating.trim(),
      theme: state.theme.trim(),
      encounterType: state.encounterType.trim() || undefined,
      possibleLocations: state.possibleLocations.length > 0 ? state.possibleLocations : undefined,
      tags: state.tags,
      resolutionType: state.resolutionType,
      sourceId: initialEncounter?.sourceId,
      page: Number.isFinite(parsedPage) ? parsedPage : undefined,
      tables: state.resolutionType === 'random_table' ? state.tables : undefined,
      creatures: state.resolutionType === 'fixed' ? state.creatures : [],
      createdAt: initialEncounter?.createdAt ?? now,
      updatedAt: now,
    };
    onSubmit(encounter);
  };

  // ---- random-table editing helpers ----
  const setTables = (tables: EncounterRollTable[]) => set('tables', tables);
  const addTable = () => setTables([...state.tables, emptyRollTable()]);
  const removeTable = (index: number) => setTables(state.tables.filter((_, i) => i !== index));
  const updateTable = (index: number, changes: Partial<EncounterRollTable>) =>
    setTables(state.tables.map((t, i) => (i === index ? { ...t, ...changes } : t)));

  const addRow = (tableIndex: number) =>
    updateTable(tableIndex, { table: [...state.tables[tableIndex].table, emptyTableRow()] });
  const removeRow = (tableIndex: number, rowIndex: number) =>
    updateTable(tableIndex, { table: state.tables[tableIndex].table.filter((_, i) => i !== rowIndex) });
  const updateRow = (tableIndex: number, rowIndex: number, changes: Partial<EncounterTableRow>) =>
    updateTable(tableIndex, {
      table: state.tables[tableIndex].table.map((r, i) => (i === rowIndex ? { ...r, ...changes } : r)),
    });

  const addRowCreature = (tableIndex: number, rowIndex: number) => {
    const row = state.tables[tableIndex].table[rowIndex];
    updateRow(tableIndex, rowIndex, { creatures: [...row.creatures, emptyTableCreature()] });
  };
  const removeRowCreature = (tableIndex: number, rowIndex: number, creatureIndex: number) => {
    const row = state.tables[tableIndex].table[rowIndex];
    updateRow(tableIndex, rowIndex, { creatures: row.creatures.filter((_, i) => i !== creatureIndex) });
  };
  const updateRowCreature = (
    tableIndex: number,
    rowIndex: number,
    creatureIndex: number,
    changes: Partial<EncounterTableCreature>,
  ) => {
    const row = state.tables[tableIndex].table[rowIndex];
    updateRow(tableIndex, rowIndex, {
      creatures: row.creatures.map((c, i) => (i === creatureIndex ? { ...c, ...changes } : c)),
    });
  };
  /** Single "count" text field per creature: a bare number -> countFixed, anything with a "d" in
   * it -> countDice (e.g. "2d4"). Mirrors how the importer parses 5etools text into the same
   * two fields, so DM-authored tables roll exactly the same way as imported ones. */
  const parseCountInput = (value: string): Pick<EncounterTableCreature, 'countDice' | 'countFixed'> => {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return { countFixed: parseInt(trimmed, 10), countDice: null };
    if (/d/i.test(trimmed) && trimmed) return { countDice: trimmed, countFixed: null };
    return { countFixed: 1, countDice: null };
  };
  const countInputValue = (c: EncounterTableCreature): string => c.countDice ?? String(c.countFixed ?? 1);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEditMode ? 'Edit Encounter' : 'Add Encounter'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField label="Name" value={state.name} onChange={(e) => set('name', e.target.value)} required fullWidth autoFocus />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Type
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={state.resolutionType}
              onChange={(_e, value: EncounterResolutionType | null) => value && set('resolutionType', value)}
            >
              <ToggleButton value="fixed">Fixed roster</ToggleButton>
              <ToggleButton value="random_table">Random table</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <TextField
            label="Description"
            value={state.description}
            onChange={(e) => set('description', e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Challenge Rating"
              value={state.challengeRating}
              onChange={(e) => set('challengeRating', e.target.value)}
              fullWidth
              placeholder="Medium (party level 3-4)"
            />
            <Autocomplete
              freeSolo
              options={ENCOUNTER_THEME_PRESETS}
              value={state.theme}
              onChange={(_e, value) => set('theme', value ?? '')}
              onInputChange={(_e, value) => set('theme', value)}
              renderInput={(params) => <TextField {...params} label="Theme" placeholder="Palace, Dark Horror, Heroic…" />}
              sx={{ flex: 1 }}
            />
          </Stack>

          {state.creatures.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <CalculateIcon fontSize="small" color="action" />
                <Typography variant="body2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                  Encounter difficulty calculator
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Total XP: <strong>{suggestion.totalXP.toLocaleString()}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Adjusted XP (×{suggestion.multiplier}): <strong>{suggestion.adjustedXP.toLocaleString()}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Suggested CR: <strong>{suggestion.cr}</strong>
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="body2">
                  Suggested difficulty: <strong>{suggestion.label}</strong>
                </Typography>
                <Button size="small" onClick={applySuggestion}>
                  Use this
                </Button>
              </Stack>
            </Paper>
          )}

          <Autocomplete<string, true, false, true>
            multiple
            freeSolo
            options={[]}
            value={state.tags}
            onChange={(_e, value) => set('tags', value as string[])}
            renderValue={(value, getItemProps) =>
              value.map((tag, index) => <Chip label={tag} size="small" {...getItemProps({ index })} key={tag} />)
            }
            renderInput={(params) => <TextField {...params} label="Other features / tags" placeholder="Type and press Enter" />}
          />

          <Box>
            <Button size="small" startIcon={<TuneIcon />} onClick={() => setMoreOpen((v) => !v)}>
              {moreOpen ? 'Hide more options' : 'More options'}
            </Button>
            <Collapse in={moreOpen}>
              <Stack spacing={2} sx={{ pt: 2 }}>
                <Autocomplete
                  freeSolo
                  options={ENCOUNTER_TYPE_PRESETS}
                  value={state.encounterType}
                  onChange={(_e, value) => set('encounterType', value ?? '')}
                  onInputChange={(_e, value) => set('encounterType', value)}
                  renderInput={(params) => (
                    <TextField {...params} label="Type of encounter" placeholder="Tavern Fight, Forest Ambush, Puzzle, Heist…" />
                  )}
                />
                <Autocomplete<string, true, false, true>
                  multiple
                  freeSolo
                  options={ENCOUNTER_LOCATION_PRESETS}
                  value={state.possibleLocations}
                  onChange={(_e, value) => set('possibleLocations', value as string[])}
                  renderValue={(value, getItemProps) =>
                    value.map((loc, index) => <Chip label={loc} size="small" {...getItemProps({ index })} key={loc} />)
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Possible locations" placeholder="Forest, Cave, Fort…" />
                  )}
                />
              </Stack>
            </Collapse>
          </Box>

          {state.resolutionType === 'fixed' && (
            <>
          <Divider />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Creatures
          </Typography>

          <Autocomplete
            options={creatures}
            getOptionLabel={(c) => c.name}
            value={null}
            onChange={(_e, value) => value && addCreature(value)}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  {option.tokenImage ? (
                    <Avatar src={option.tokenImage} sx={{ width: 24, height: 24 }} />
                  ) : (
                    <Avatar sx={{ width: 24, height: 24 }}>{option.name.charAt(0)}</Avatar>
                  )}
                  <Typography variant="body2">{option.name}</Typography>
                </Stack>
              </li>
            )}
            renderInput={(params) => <TextField {...params} label="Search creatures to add…" placeholder="Goblin, Hobgoblin…" />}
          />

          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              label="Add custom creature"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomCreature();
                }
              }}
            />
            <Tooltip title="Add custom creature">
              <IconButton onClick={addCustomCreature} disabled={!customName.trim()}>
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          {state.creatures.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
              No creatures added yet.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {state.creatures.map((entry) => (
                <Stack
                  key={entry.id}
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}
                >
                  {entry.imageSrc ? (
                    <Avatar src={entry.imageSrc} sx={{ width: 32, height: 32 }} />
                  ) : (
                    <Avatar sx={{ width: 32, height: 32 }}>{entry.name.charAt(0)}</Avatar>
                  )}
                  <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                    {entry.name}
                    {entry.creatureId === null && (
                      <Typography component="span" variant="caption" color="text.secondary">
                        {' '}
                        (custom)
                      </Typography>
                    )}
                  </Typography>
                  <IconButton size="small" onClick={() => updateQuantity(entry.id, -1)}>
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Box sx={{ minWidth: 24, textAlign: 'center' }}>
                    <Typography variant="body2">{entry.quantity}</Typography>
                  </Box>
                  <IconButton size="small" onClick={() => updateQuantity(entry.id, 1)}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                  <Tooltip title="Remove">
                    <IconButton size="small" onClick={() => removeEntry(entry.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          )}
            </>
          )}

          {state.resolutionType === 'random_table' && (
            <>
              <Divider />
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                  Roll tables
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  label="Page"
                  value={state.page}
                  onChange={(e) => set('page', e.target.value)}
                  sx={{ width: 90 }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Each table is rolled with its own die to pick a result row; if a row names
                creatures with a dice count (e.g. "2d4"), that's rolled separately once the row
                is selected. See the map toolbar's Encounters tab to roll one of these live.
              </Typography>

              {state.tables.map((table, tableIndex) => (
                <Paper key={tableIndex} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
                    <TextField
                      size="small"
                      label="Dice expression"
                      value={table.diceExpression}
                      onChange={(e) => updateTable(tableIndex, { diceExpression: e.target.value })}
                      placeholder="1d10, d100, d12 + d8…"
                      sx={{ width: 160 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Min level"
                      value={table.minlvl ?? ''}
                      onChange={(e) => updateTable(tableIndex, { minlvl: e.target.value ? Number(e.target.value) : null })}
                      sx={{ width: 100 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Max level"
                      value={table.maxlvl ?? ''}
                      onChange={(e) => updateTable(tableIndex, { maxlvl: e.target.value ? Number(e.target.value) : null })}
                      sx={{ width: 100 }}
                    />
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title="Remove table">
                      <IconButton size="small" onClick={() => removeTable(tableIndex)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <Stack spacing={1.5}>
                    {table.table.map((row, rowIndex) => (
                      <Paper key={rowIndex} variant="outlined" sx={{ p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                          <TextField
                            size="small"
                            type="number"
                            label="Min"
                            value={row.min}
                            onChange={(e) => updateRow(tableIndex, rowIndex, { min: Number(e.target.value) })}
                            sx={{ width: 80 }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label="Max"
                            value={row.max}
                            onChange={(e) => updateRow(tableIndex, rowIndex, { max: Number(e.target.value) })}
                            sx={{ width: 80 }}
                          />
                          <TextField
                            size="small"
                            fullWidth
                            label="Result"
                            value={row.resultText}
                            onChange={(e) =>
                              updateRow(tableIndex, rowIndex, { resultText: e.target.value, result: e.target.value })
                            }
                            placeholder="2d4 Pirates and one Pirate Captain aboard a longship…"
                          />
                          <Tooltip title="Remove row">
                            <IconButton size="small" onClick={() => removeRow(tableIndex, rowIndex)}>
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>

                        <Stack spacing={0.75} sx={{ pl: 1 }}>
                          {row.creatures.map((c, creatureIndex) => (
                            <Stack key={creatureIndex} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <CasinoIcon fontSize="small" color="action" />
                              <TextField
                                size="small"
                                variant="standard"
                                label="Creature"
                                value={c.name}
                                onChange={(e) =>
                                  updateRowCreature(tableIndex, rowIndex, creatureIndex, { name: e.target.value })
                                }
                                sx={{ flexGrow: 1 }}
                              />
                              <TextField
                                size="small"
                                variant="standard"
                                label="Count"
                                value={countInputValue(c)}
                                onChange={(e) =>
                                  updateRowCreature(tableIndex, rowIndex, creatureIndex, parseCountInput(e.target.value))
                                }
                                placeholder="2d4 or 1"
                                sx={{ width: 90 }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => removeRowCreature(tableIndex, rowIndex, creatureIndex)}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          ))}
                          <Button size="small" startIcon={<AddIcon />} onClick={() => addRowCreature(tableIndex, rowIndex)} sx={{ alignSelf: 'flex-start' }}>
                            Add creature to this row
                          </Button>
                        </Stack>
                      </Paper>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={() => addRow(tableIndex)}>
                      Add row
                    </Button>
                  </Stack>
                </Paper>
              ))}
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addTable}>
                Add table
              </Button>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid}>
          {isEditMode ? 'Save Changes' : 'Add Encounter'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
