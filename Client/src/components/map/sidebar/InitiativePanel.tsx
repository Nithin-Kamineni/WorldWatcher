import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CasinoIcon from '@mui/icons-material/Casino';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShieldIcon from '@mui/icons-material/Shield';
import NotesIcon from '@mui/icons-material/Notes';
import EditIcon from '@mui/icons-material/Edit';
import TuneIcon from '@mui/icons-material/Tune';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import { SectionHeader } from '../../shell/SectionHeader';
import type { InitiativeState } from '../../../types/initiative';
import type { PlacedToken } from '../../../types/token';
import { TokenThumbnail } from '../TokenThumbnail';
import { TokenEffectsEditor } from './TokenEffectsEditor';
import { formatCombo } from '../../../types/shortcut';
import { getEffectiveCombo, type ShortcutOverride } from '../../../store/useShortcutStore';

type TokenCombatChanges = Partial<Pick<PlacedToken, 'hp' | 'concentrating' | 'deathSaves' | 'notes' | 'effects'>>;

interface InitiativePanelProps {
  placedTokens: PlacedToken[];
  initiative: InitiativeState;
  onRollInitiative: () => void;
  onCancelRoll: () => void;
  onUpdateBaseRoll: (entryId: string, baseRoll: number) => void;
  onToggleEntryLock: (entryId: string) => void;
  onStartEncounter: () => void;
  onNextTurn: () => void;
  onEndEncounter: () => void;
  onUpdateToken: (tokenId: string, changes: TokenCombatChanges) => void;
  selectedTokenIds: string[];
  onTokenSelect: (token: PlacedToken, additive: boolean) => void;
  /** Opens this combatant's creature in the sidebar's Reference panel (checklist E13). */
  onTokenStatsRequest: (token: PlacedToken) => void;
  /** Opens this token's row under Tokens > On map (rename, notes, size...). */
  onEditToken: (tokenId: string) => void;
  shortcutOverrides: Record<string, ShortcutOverride>;
}

function comboLabel(overrides: Record<string, ShortcutOverride>, actionId: string): string {
  return formatCombo(getEffectiveCombo(overrides, actionId));
}

export function InitiativePanel({
  placedTokens,
  initiative,
  onRollInitiative,
  onCancelRoll,
  onUpdateBaseRoll,
  onToggleEntryLock,
  onStartEncounter,
  onNextTurn,
  onEndEncounter,
  onUpdateToken,
  selectedTokenIds,
  onTokenSelect,
  onTokenStatsRequest,
  onEditToken,
  shortcutOverrides,
}: InitiativePanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sortedEntries = [...initiative.entries].sort((a, b) => b.roll - a.roll);
  const tokenById = new Map(placedTokens.map((t) => [t.id, t]));
  /** Right-click menu on a row, positioned at the cursor. */
  const [rowMenu, setRowMenu] = useState<{ entryId: string; tokenId: string; x: number; y: number } | null>(null);
  /** The row whose initiative was just reopened from that menu - its field takes focus. */
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  /** Changing initiative mid-combat is rare, so there is no lock button on the rows any more:
   * right-click > Change initiative unlocks the entry, which brings its d20 field back, and
   * finishing the edit (Enter, or clicking away) locks it again. */
  const handleChangeInitiative = (entryId: string) => {
    const entry = initiative.entries.find((e) => e.id === entryId);
    if (entry?.locked) onToggleEntryLock(entryId);
    setEditingEntryId(entryId);
    setRowMenu(null);
  };
  const menuToken = rowMenu ? tokenById.get(rowMenu.tokenId) : undefined;
  const rollInputs = useRef(new Map<string, HTMLInputElement>());

  // Focus the reopened field a tick later rather than via autoFocus: the menu is closing in
  // the same commit, and an entry that was already unlocked keeps its field mounted, so
  // autoFocus would either lose to the menu's focus handling or never fire at all.
  useEffect(() => {
    if (!editingEntryId) return;
    const timer = window.setTimeout(() => {
      const input = rollInputs.current.get(editingEntryId);
      input?.focus();
      input?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editingEntryId]);

  return (
    <Stack sx={{ height: '100%' }}>
      <SectionHeader icon={<FormatListNumberedIcon fontSize="small" />} title="Initiative" />

      {initiative.status === 'idle' && (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Roll initiative for every token currently on this floor (d20 + DEX for creatures that have it).
          </Typography>
          <Tooltip title={`Roll Initiative (${comboLabel(shortcutOverrides, 'rerollInitiative')})`} placement="top">
            <span>
              <Button
                variant="contained"
                fullWidth
                startIcon={<CasinoIcon />}
                onClick={onRollInitiative}
                disabled={placedTokens.length === 0}
              >
                Roll Initiative
              </Button>
            </span>
          </Tooltip>
        </Box>
      )}

      {(initiative.status === 'rolling' || initiative.status === 'active') && (
        <>
          <Stack sx={{ flexGrow: 1, overflowY: 'auto', p: 1.5 }} spacing={1}>
            {initiative.status === 'active' && (
              <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
                Round {initiative.round}
              </Typography>
            )}
            {sortedEntries.map((entry) => {
              const token = tokenById.get(entry.tokenId);
              if (!token) return null;
              const isCurrent = initiative.status === 'active' && entry.id === initiative.currentEntryId;
              const isExpanded = expandedId === entry.id;
              const isDown = !!token.hp && token.hp.current <= 0;
              const isLocked = initiative.status === 'active' && !!entry.locked;
              const isUnlocked = initiative.status === 'active' && !entry.locked;
              const showInitiative = !isLocked; // rolling, or active-but-unlocked
              const isSelected = selectedTokenIds.includes(token.id);

              // Whole row: plain click toggles expand, ctrl/cmd+click toggles multi-select
              // instead (same selectedTokenIds/onTokenSelect the map uses, so a selection made
              // here or on the map shows up in both places).
              const handleRowClick = (e: React.MouseEvent) => {
                if (e.ctrlKey || e.metaKey) {
                  onTokenSelect(token, true);
                  return;
                }
                setExpandedId(isExpanded ? null : entry.id);
              };

              const handleRowContextMenu = (e: React.MouseEvent) => {
                e.preventDefault();
                setRowMenu({ entryId: entry.id, tokenId: token.id, x: e.clientX, y: e.clientY });
              };

              // Leaving the field (Enter blurs it) re-locks a mid-combat edit. Rolling-phase
              // entries are left alone - Start Encounter locks all of them at once.
              const handleRollCommit = () => {
                if (editingEntryId === entry.id) setEditingEntryId(null);
                if (initiative.status === 'active' && !entry.locked) onToggleEntryLock(entry.id);
              };

              return (
                <Box
                  key={entry.id}
                  onClick={handleRowClick}
                  onContextMenu={handleRowContextMenu}
                  sx={{
                    borderRadius: 2,
                    cursor: 'pointer',
                    bgcolor: isCurrent ? 'action.selected' : 'action.hover',
                    border: '2px solid',
                    borderColor: isSelected ? '#29b6f6' : isCurrent ? 'primary.main' : 'transparent',
                    boxShadow: isUnlocked ? '0 0 0 2px rgba(255,255,255,0.85), 0 0 10px 2px rgba(255,255,255,0.55)' : 'none',
                    transition: 'box-shadow 0.2s, border-color 0.2s',
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', p: 1 }}>
                    <Box sx={{ position: 'relative', flexShrink: 0 }}>
                      <TokenThumbnail src={token.imageSrc} name={token.name} size={32} border={`2px solid ${token.outlineColor}`} />
                      {token.concentrating && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: -1,
                            right: -1,
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            bgcolor: '#1e88e5',
                            border: '1.5px solid',
                            borderColor: 'background.paper',
                          }}
                        />
                      )}
                      {token.effects.length > 0 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: -1,
                            right: -1,
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            bgcolor: '#c0392b',
                            border: '1.5px solid',
                            borderColor: 'background.paper',
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                      {token.name}
                    </Typography>
                    {showInitiative ? (
                      // showInitiative already excludes the active-and-locked case, so the
                      // roll is always editable here - rolling (pre-Start) or unlocked mid-combat.
                      <Stack
                        direction="row"
                        spacing={0.25}
                        sx={{ alignItems: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Typography variant="caption" color="text.secondary">
                          d20
                        </Typography>
                        <TextField
                          type="number"
                          size="small"
                          variant="standard"
                          value={entry.baseRoll}
                          inputRef={(el: HTMLInputElement | null) => {
                            if (el) rollInputs.current.set(entry.id, el);
                            else rollInputs.current.delete(entry.id);
                          }}
                          onChange={(e) => onUpdateBaseRoll(entry.id, Number(e.target.value))}
                          onBlur={handleRollCommit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          sx={{ width: 34 }}
                          slotProps={{ htmlInput: { style: { textAlign: 'right' } } }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {entry.modifier >= 0 ? `+${entry.modifier}` : entry.modifier} = {entry.roll}
                        </Typography>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                        <Tooltip title="Armor Class">
                          <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
                            <ShieldIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                            <Typography variant="caption">{token.ac ?? '—'}</Typography>
                          </Stack>
                        </Tooltip>
                        <Tooltip title={`Hit Points - Apply Damage (${comboLabel(shortcutOverrides, 'applyDamage')}) / Apply Healing (${comboLabel(shortcutOverrides, 'applyHealing')})`}>
                          <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
                            <FavoriteIcon sx={{ fontSize: 15, color: 'error.main' }} />
                            <Typography variant="caption">
                              {token.hp ? `${token.hp.current}/${token.hp.max}` : '—'}
                            </Typography>
                          </Stack>
                        </Tooltip>
                      </Stack>
                    )}
                    <Tooltip title={token.creatureId ? 'Open stat block in Reference' : 'No linked creature to show'}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={!token.creatureId}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTokenStatsRequest(token);
                          }}
                        >
                          <AssignmentIndOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : entry.id);
                      }}
                    >
                      {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  </Stack>

                  {initiative.status === 'active' && (
                    <Collapse in={isExpanded}>
                      <Stack spacing={1} sx={{ px: 1.5, pb: 1.5 }} onClick={(e) => e.stopPropagation()}>
                        <Typography variant="caption" color="text.secondary">
                          Initiative {entry.roll}
                          {entry.locked ? ' - right-click the row to change it' : ''}
                        </Typography>

                        <Tooltip
                          title={`Apply Damage (${comboLabel(shortcutOverrides, 'applyDamage')}) / Apply Healing (${comboLabel(shortcutOverrides, 'applyHealing')}) / Apply Temporary HP (${comboLabel(shortcutOverrides, 'applyTempHp')}) - select this combatant on the map to use the shortcut, or edit directly here`}
                          placement="top"
                        >
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <FavoriteIcon fontSize="small" color="error" />
                            <TextField
                              type="number"
                              size="small"
                              variant="standard"
                              label="HP"
                              value={token.hp?.current ?? 0}
                              onChange={(e) =>
                                onUpdateToken(token.id, { hp: { current: Number(e.target.value), max: token.hp?.max ?? 0 } })
                              }
                              sx={{ width: 56 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              /
                            </Typography>
                            <TextField
                              type="number"
                              size="small"
                              variant="standard"
                              label="Max"
                              value={token.hp?.max ?? 0}
                              onChange={(e) =>
                                onUpdateToken(token.id, { hp: { current: token.hp?.current ?? 0, max: Number(e.target.value) } })
                              }
                              sx={{ width: 56 }}
                            />
                            <FormControlLabel
                              sx={{ ml: 1 }}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={!!token.concentrating}
                                  onChange={(e) => onUpdateToken(token.id, { concentrating: e.target.checked })}
                                />
                              }
                              label={<Typography variant="caption">Conc.</Typography>}
                            />
                          </Stack>
                        </Tooltip>

                        {isDown && (
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              Death saves
                            </Typography>
                            {[0, 1, 2].map((i) => (
                              <Checkbox
                                key={`s-${i}`}
                                size="small"
                                checked={(token.deathSaves?.successes ?? 0) > i}
                                onChange={() =>
                                  onUpdateToken(token.id, {
                                    deathSaves: {
                                      successes: (token.deathSaves?.successes ?? 0) > i ? i : i + 1,
                                      failures: token.deathSaves?.failures ?? 0,
                                    },
                                  })
                                }
                                sx={{ color: 'success.main', p: 0.25 }}
                              />
                            ))}
                            {[0, 1, 2].map((i) => (
                              <Checkbox
                                key={`f-${i}`}
                                size="small"
                                checked={(token.deathSaves?.failures ?? 0) > i}
                                onChange={() =>
                                  onUpdateToken(token.id, {
                                    deathSaves: {
                                      failures: (token.deathSaves?.failures ?? 0) > i ? i : i + 1,
                                      successes: token.deathSaves?.successes ?? 0,
                                    },
                                  })
                                }
                                sx={{ color: 'error.main', p: 0.25 }}
                              />
                            ))}
                          </Stack>
                        )}

                        <Box>
                          <Tooltip title={`Add Tag (${comboLabel(shortcutOverrides, 'addTag')})`} placement="top-start">
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'inline-block', mb: 0.5 }}>
                              Effects
                            </Typography>
                          </Tooltip>
                          <TokenEffectsEditor
                            effects={token.effects}
                            onChange={(effects) => onUpdateToken(token.id, { effects })}
                          />
                        </Box>

                        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                          <NotesIcon fontSize="small" sx={{ mt: 1, color: 'text.secondary' }} />
                          <Tooltip title={`Update Persistent Notes (${comboLabel(shortcutOverrides, 'updatePersistentNotes')})`} placement="top-start">
                            <TextField
                              size="small"
                              variant="outlined"
                              placeholder="Spell slots, abilities, anything else to track…"
                              multiline
                              minRows={2}
                              fullWidth
                              value={token.notes ?? ''}
                              onChange={(e) => onUpdateToken(token.id, { notes: e.target.value })}
                            />
                          </Tooltip>
                        </Stack>
                      </Stack>
                    </Collapse>
                  )}
                </Box>
              );
            })}
          </Stack>

          <Menu
            open={!!rowMenu}
            onClose={() => setRowMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={rowMenu ? { top: rowMenu.y, left: rowMenu.x } : undefined}
            disableRestoreFocus
            onContextMenu={(e) => {
              e.preventDefault();
              setRowMenu(null);
            }}
          >
            {/* Before Start Encounter every roll is already editable - nothing to reopen. */}
            <MenuItem
              disabled={initiative.status !== 'active'}
              onClick={() => rowMenu && handleChangeInitiative(rowMenu.entryId)}
            >
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Change initiative</ListItemText>
            </MenuItem>
            <MenuItem
              disabled={!menuToken?.creatureId}
              onClick={() => {
                if (menuToken) onTokenStatsRequest(menuToken);
                setRowMenu(null);
              }}
            >
              <ListItemIcon>
                <AssignmentIndOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Open stat block</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (rowMenu) onEditToken(rowMenu.tokenId);
                setRowMenu(null);
              }}
            >
              <ListItemIcon>
                <TuneIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit token (rename, notes…)</ListItemText>
            </MenuItem>
          </Menu>

          <Divider />
          <Stack spacing={1} sx={{ p: 1.5 }}>
            {initiative.status === 'rolling' ? (
              <>
                <Tooltip title={`Start Encounter (${comboLabel(shortcutOverrides, 'startEncounter')})`}>
                  <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={onStartEncounter}>
                    Start Encounter
                  </Button>
                </Tooltip>
                <Button variant="outlined" color="inherit" onClick={onCancelRoll}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Tooltip title={`Next Turn (${comboLabel(shortcutOverrides, 'nextTurn')})`}>
                  <Button variant="contained" startIcon={<SkipNextIcon />} onClick={onNextTurn}>
                    Next Turn
                  </Button>
                </Tooltip>
                <Tooltip title={`End Encounter (${comboLabel(shortcutOverrides, 'endEncounter')})`}>
                  <Button variant="outlined" color="error" startIcon={<StopCircleIcon />} onClick={onEndEncounter}>
                    End Encounter
                  </Button>
                </Tooltip>
              </>
            )}
          </Stack>
        </>
      )}
    </Stack>
  );
}
