import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { SHORTCUT_ACTIONS, comboFromKeyboardEvent, formatCombo, type ShortcutCategory } from '../../types/shortcut';
import {
  useShortcutStore,
  getEffectiveCombo,
  getEffectiveToolbar,
  getEffectiveInline,
  findComboOwner,
  type ShortcutOverride,
} from '../../store/useShortcutStore';

interface ShortcutsSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Full keyboard-shortcuts editor, mirroring the Improved Initiative settings screenshots:
 * one table per category, an editable hotkey cell, and Toolbar/Inline visibility checkboxes.
 * Edits buffer in local `draft` state and only commit to useShortcutStore on Save and Close -
 * closing any other way (X, backdrop, Cancel) discards them. */
export function ShortcutsSettingsDialog({ open, onClose }: ShortcutsSettingsDialogProps) {
  const storedOverrides = useShortcutStore((state) => state.overrides);
  const replaceAll = useShortcutStore((state) => state.replaceAll);

  const [draft, setDraft] = useState<Record<string, ShortcutOverride>>({});
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [collisionMessage, setCollisionMessage] = useState<{ actionId: string; text: string } | null>(null);

  // Re-seed the draft from the committed store every time the dialog opens, so a prior
  // cancelled edit session never leaks into the next one.
  useEffect(() => {
    if (open) {
      setDraft(storedOverrides);
      setCapturingId(null);
      setCollisionMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!capturingId) return;
    const action = SHORTCUT_ACTIONS.find((a) => a.id === capturingId);
    if (!action) return;

    const handleCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setCapturingId(null);
        return;
      }
      const combo = comboFromKeyboardEvent(e);
      const owner = findComboOwner(draft, action.category, combo, action.id);
      if (owner) {
        const ownerLabel = SHORTCUT_ACTIONS.find((a) => a.id === owner)?.label ?? owner;
        setCollisionMessage({ actionId: action.id, text: `Already assigned to ${ownerLabel}` });
        return;
      }
      setDraft((prev) => ({ ...prev, [action.id]: { ...prev[action.id], combo } }));
      setCollisionMessage(null);
      setCapturingId(null);
    };

    window.addEventListener('keydown', handleCapture, true);
    return () => window.removeEventListener('keydown', handleCapture, true);
  }, [capturingId, draft]);

  const handleResetRow = (actionId: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[actionId];
      return next;
    });
    setCollisionMessage(null);
  };

  const handleResetAll = () => {
    setDraft({});
    setCollisionMessage(null);
  };

  const handleSaveAndClose = () => {
    replaceAll(draft);
    onClose();
  };

  const renderTable = (category: ShortcutCategory, title: string) => {
    const actions = SHORTCUT_ACTIONS.filter((a) => a.category === category);
    return (
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 36 }} />
              <TableCell>Command</TableCell>
              <TableCell sx={{ width: 160 }}>Hotkey</TableCell>
              <TableCell align="center" sx={{ width: 80 }}>
                Toolbar
              </TableCell>
              {category === 'combatant' && (
                <TableCell align="center" sx={{ width: 80 }}>
                  Inline
                </TableCell>
              )}
              <TableCell sx={{ width: 40 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {actions.map((action) => {
              const Icon = action.icon;
              const combo = getEffectiveCombo(draft, action.id);
              const isCapturing = capturingId === action.id;
              const collision = collisionMessage?.actionId === action.id ? collisionMessage.text : null;
              const isCustomized = !!draft[action.id];
              return (
                <TableRow key={action.id} sx={{ opacity: action.wired ? 1 : 0.55 }}>
                  <TableCell>
                    <Icon fontSize="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{action.label}</Typography>
                    {!action.wired && (
                      <Typography variant="caption" color="text.secondary">
                        Not yet active
                      </Typography>
                    )}
                    {collision && (
                      <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                        {collision}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={isCapturing ? 'Press a key…' : formatCombo(combo) || '(none)'}
                      size="small"
                      color={isCapturing ? 'primary' : 'default'}
                      onClick={() => {
                        setCollisionMessage(null);
                        setCapturingId(action.id);
                      }}
                      sx={{ cursor: 'pointer', minWidth: 110, fontFamily: 'monospace' }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Checkbox
                      size="small"
                      checked={getEffectiveToolbar(draft, action.id)}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [action.id]: { ...prev[action.id], toolbar: e.target.checked } }))
                      }
                    />
                  </TableCell>
                  {category === 'combatant' && (
                    <TableCell align="center">
                      <Checkbox
                        size="small"
                        checked={getEffectiveInline(draft, action.id)}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [action.id]: { ...prev[action.id], inline: e.target.checked } }))
                        }
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    {isCustomized && (
                      <Tooltip title="Reset to default">
                        <IconButton size="small" onClick={() => handleResetRow(action.id)}>
                          <RestartAltIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Stack>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Keyboard Shortcuts</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Defaults match the Improved Initiative web app. Click a hotkey to rebind it. Actions marked
          "Not yet active" are reserved for a future update but can still be customized here.
        </Typography>
        {renderTable('encounter', 'Encounter Commands')}
        {renderTable('combatant', 'Combatant Commands')}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
        <Button color="inherit" onClick={handleResetAll}>
          Reset all to defaults
        </Button>
        <Stack direction="row" spacing={1}>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveAndClose}>
            Save and Close
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
