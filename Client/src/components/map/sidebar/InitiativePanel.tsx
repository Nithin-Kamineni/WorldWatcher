import { useState } from 'react';
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
import CasinoIcon from '@mui/icons-material/Casino';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FavoriteIcon from '@mui/icons-material/Favorite';
import NotesIcon from '@mui/icons-material/Notes';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import type { InitiativeState } from '../../../types/initiative';
import type { PlacedToken } from '../../../types/token';
import { TokenThumbnail } from '../TokenThumbnail';
import { TokenEffectsEditor } from '../toolbar/TokenEffectsEditor';

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
}: InitiativePanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sortedEntries = [...initiative.entries].sort((a, b) => b.roll - a.roll);
  const tokenById = new Map(placedTokens.map((t) => [t.id, t]));

  return (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Initiative
        </Typography>
      </Box>
      <Divider />

      {initiative.status === 'idle' && (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Roll initiative for every token currently on this floor (d20 + DEX for creatures that have it).
          </Typography>
          <Button
            variant="contained"
            fullWidth
            startIcon={<CasinoIcon />}
            onClick={onRollInitiative}
            disabled={placedTokens.length === 0}
          >
            Roll Initiative
          </Button>
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
              const isUnlocked = initiative.status === 'active' && !entry.locked;
              const rollEditable = initiative.status !== 'active' || !entry.locked;
              return (
                <Box
                  key={entry.id}
                  sx={{
                    borderRadius: 2,
                    bgcolor: isCurrent ? 'action.selected' : 'action.hover',
                    border: isCurrent ? '2px solid' : '2px solid transparent',
                    borderColor: isCurrent ? 'primary.main' : 'transparent',
                    boxShadow: isUnlocked ? '0 0 0 2px rgba(255,255,255,0.85), 0 0 10px 2px rgba(255,255,255,0.55)' : 'none',
                    transition: 'box-shadow 0.2s',
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', p: 1 }}>
                    <TokenThumbnail src={token.imageSrc} name={token.name} size={32} border={`2px solid ${token.outlineColor}`} />
                    <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                      {token.name}
                    </Typography>
                    <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
                      {rollEditable ? (
                        <>
                          <Typography variant="caption" color="text.secondary">
                            d20
                          </Typography>
                          <TextField
                            type="number"
                            size="small"
                            variant="standard"
                            value={entry.baseRoll}
                            onChange={(e) => onUpdateBaseRoll(entry.id, Number(e.target.value))}
                            sx={{ width: 34 }}
                            slotProps={{ htmlInput: { style: { textAlign: 'right' } } }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {entry.modifier >= 0 ? `+${entry.modifier}` : entry.modifier} = {entry.roll}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {entry.roll}
                        </Typography>
                      )}
                    </Stack>
                    {initiative.status === 'active' && (
                      <Tooltip title={entry.locked ? 'Unlock to edit initiative' : 'Lock initiative'}>
                        <IconButton size="small" onClick={() => onToggleEntryLock(entry.id)}>
                          {entry.locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" color="warning" />}
                        </IconButton>
                      </Tooltip>
                    )}
                    {initiative.status === 'active' && (
                      <IconButton size="small" onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                        {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                    )}
                  </Stack>

                  {initiative.status === 'active' && (
                    <Collapse in={isExpanded}>
                      <Stack spacing={1} sx={{ px: 1.5, pb: 1.5 }}>
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
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Effects
                          </Typography>
                          <TokenEffectsEditor
                            effects={token.effects}
                            onChange={(effects) => onUpdateToken(token.id, { effects })}
                          />
                        </Box>

                        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                          <NotesIcon fontSize="small" sx={{ mt: 1, color: 'text.secondary' }} />
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
                        </Stack>
                      </Stack>
                    </Collapse>
                  )}
                </Box>
              );
            })}
          </Stack>

          <Divider />
          <Stack spacing={1} sx={{ p: 1.5 }}>
            {initiative.status === 'rolling' ? (
              <>
                <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={onStartEncounter}>
                  Start Encounter
                </Button>
                <Button variant="outlined" color="inherit" onClick={onCancelRoll}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="contained" startIcon={<SkipNextIcon />} onClick={onNextTurn}>
                  Next Turn
                </Button>
                <Button variant="outlined" color="error" startIcon={<StopCircleIcon />} onClick={onEndEncounter}>
                  End Encounter
                </Button>
              </>
            )}
          </Stack>
        </>
      )}
    </Stack>
  );
}
