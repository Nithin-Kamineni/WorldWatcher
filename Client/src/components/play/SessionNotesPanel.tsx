import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import OpenInNewIcon from '@mui/icons-material/OpenInNewOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { PaneHeader, type PaneCloseProps } from './layout/PaneHeader';
import type { PaneSlot } from './layout/playLayoutTrees';
import { EntityRefPreview } from '../notes/EntityRefPreview';
import { BBCodeEditor } from '../world/BBCodeEditor';
import { useNoteStore } from '../../store/useNoteStore';
import { thinScrollbarSx, FLOATING_SCROLLBAR_CLASS } from '../../theme/scrollbarSx';
import type { Note } from '../../types/note';

interface SessionNotesPanelProps extends PaneCloseProps {
  /** Which pane this panel occupies - the header uses it as its drag handle identity. */
  slot: PaneSlot;
  worldId: string;
  campaignId: string;
  note: Note;
  /** Session + Narrative notes for this campaign - the switcher menu lets the DM glance at a
   * Narrative note without losing the active chat thread (which stays anchored to the
   * originally-picked session note). */
  switchableNotes: Note[];
  onSwitchNote: (noteId: string) => void;
  onOpenSituationalTable: (tableId: string) => void;
  /** Leading header icon that lets this pane be swapped for a different window type - see
   * WindowKindSwitcher, rendered by the parent (PaneWindow) so this component stays unaware of
   * the layout system around it. */
  kindSwitcher?: ReactNode;
}

/** The always-visible half of the Play workspace: a read-only render of the running session's
 * prep note (or, via the switcher, any Narrative note for reference) - with an in-place "Quick
 * edit" toggle (issues.txt 10.a) for small mid-session touch-ups without leaving Play. Full
 * editing (tags, rename, etc.) still happens in the full Notes editor via "Open in Notes". */
export function SessionNotesPanel({
  slot,
  worldId,
  campaignId,
  note,
  switchableNotes,
  onSwitchNote,
  onOpenSituationalTable,
  kindSwitcher,
  ...closeProps
}: SessionNotesPanelProps) {
  const navigate = useNavigate();
  const updateNote = useNoteStore((s) => s.updateNote);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const kindLabel = note.kind === 'narrative' ? 'Narrative' : 'Session';

  const startEdit = () => {
    setDraft(note.body);
    setEditing(true);
  };
  const finishEdit = () => {
    if (draft !== note.body) updateNote(note.id, { body: draft });
    setEditing(false);
  };

  return (
    <Paper
      variant="outlined"
      sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 1.5, overflow: 'hidden' }}
    >
      <PaneHeader
        slot={slot}
        leading={kindSwitcher}
        title={note.name}
        {...closeProps}
        actions={
          <>
            <Chip label={kindLabel} size="small" variant="outlined" sx={{ height: 19, fontSize: 11, mr: 0.25, flexShrink: 0 }} />
            <Tooltip title={editing ? 'Save' : 'Quick edit'}>
              <IconButton size="small" onClick={editing ? finishEdit : startEdit} color={editing ? 'primary' : 'default'}>
                {editing ? <CheckIcon fontSize="small" /> : <EditOutlinedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Switch note">
              <span>
                <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} disabled={editing}>
                  <SwapHorizIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Open in Notes">
              <IconButton size="small" onClick={() => navigate(`/w/${worldId}/c/${campaignId}/notes/${note.id}`)}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        }
      />

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {switchableNotes.length === 0 && <MenuItem disabled>No notes yet</MenuItem>}
        {switchableNotes.map((n) => (
          <MenuItem
            key={n.id}
            selected={n.id === note.id}
            onClick={() => {
              onSwitchNote(n.id);
              setAnchorEl(null);
            }}
          >
            <ListItemText primary={n.name} secondary={n.kind === 'narrative' ? 'Narrative' : 'Session'} />
          </MenuItem>
        ))}
      </Menu>

      <Box
        className={FLOATING_SCROLLBAR_CLASS}
        sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0, px: editing ? 1.5 : 2.5, py: editing ? 1.5 : 2, ...thinScrollbarSx }}
      >
        {editing ? (
          <BBCodeEditor value={draft} onChange={setDraft} worldId={worldId} campaignId={campaignId} hideLabel />
        ) : note.body ? (
          <EntityRefPreview
            body={note.body}
            worldId={worldId}
            campaignId={campaignId}
            noteName={note.name}
            onOpenSituationalTable={onOpenSituationalTable}
            enableItemsWindowFocus
            sx={{ lineHeight: 1.6, '& h1, & h2, & h3': { mt: 0 } }}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            This note is empty.
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
