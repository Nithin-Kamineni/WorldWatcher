import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import CheckIcon from '@mui/icons-material/Check';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import BuildIcon from '@mui/icons-material/Build';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQuickToolsStore } from '../../store/useQuickToolsStore';
import { useShellStore } from '../../store/useShellStore';

interface RightPanelUtilityStripProps {
  worldId?: string;
}

function TodoPopoverContent({ worldId }: { worldId: string }) {
  const todos = useQuickToolsStore((s) => s.todosByWorldId[worldId] ?? []);
  const addTodo = useQuickToolsStore((s) => s.addTodo);
  const toggleTodo = useQuickToolsStore((s) => s.toggleTodo);
  const deleteTodo = useQuickToolsStore((s) => s.deleteTodo);
  const [draft, setDraft] = useState('');

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    addTodo(worldId, text);
    setDraft('');
  };

  return (
    <Box sx={{ p: 2, width: 280 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        TODO list
      </Typography>
      <Stack spacing={0.5} sx={{ maxHeight: 240, overflowY: 'auto', mb: 1 }}>
        {todos.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Nothing yet — add something below.
          </Typography>
        )}
        {todos.map((t) => (
          <Stack key={t.id} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Checkbox size="small" checked={t.done} onChange={() => toggleTodo(worldId, t.id)} />
            <Typography
              variant="body2"
              sx={{ flexGrow: 1, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'text.secondary' : 'text.primary' }}
            >
              {t.text}
            </Typography>
            <IconButton size="small" onClick={() => deleteTodo(worldId, t.id)}>
              <DeleteIcon fontSize="inherit" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          fullWidth
          placeholder="Add a to-do…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <IconButton size="small" onClick={submit}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}

function NotesPopoverContent({ worldId }: { worldId: string }) {
  const notes = useQuickToolsStore((s) => s.notesByWorldId[worldId] ?? '');
  const setNotes = useQuickToolsStore((s) => s.setNotes);

  return (
    <Box sx={{ p: 2, width: 280 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Quick notes
      </Typography>
      <TextField
        multiline
        minRows={6}
        fullWidth
        size="small"
        placeholder="Jot something down…"
        value={notes}
        onChange={(e) => setNotes(worldId, e.target.value)}
      />
    </Box>
  );
}

interface StripButton {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: (anchor: HTMLElement) => void;
}

/** The RightPanel's utility strip (issue 8a, laid out vertically per issue 2): TODO list,
 * Quick notes, Create new item, Create new content, Close/collapse - matching the 5-icon
 * reference screenshot (blue check, orange note, green tools, green plus, grey chevron).
 * TODO/Notes open a small popover backed by useQuickToolsStore; the two "create" icons jump
 * into the existing unified Create-new flow (ArticleTypePicker's "pick a type" page covers
 * both game entities and articles); Close collapses the panel via the existing shell store. */
export function RightPanelUtilityStrip({ worldId }: RightPanelUtilityStripProps) {
  const navigate = useNavigate();
  const toggle = useShellStore((s) => s.toggleRightPanel);
  const [openPopover, setOpenPopover] = useState<{ key: string; anchor: HTMLElement } | null>(null);

  const buttons: StripButton[] = [
    {
      key: 'todo',
      label: 'TODO list',
      icon: <CheckIcon fontSize="small" />,
      color: '#3b82f6',
      onClick: (anchor) => setOpenPopover({ key: 'todo', anchor }),
    },
    {
      key: 'notes',
      label: 'Quick notes',
      icon: <StickyNote2Icon fontSize="small" />,
      color: '#d97706',
      onClick: (anchor) => setOpenPopover({ key: 'notes', anchor }),
    },
    {
      key: 'create-item',
      label: 'Create new item',
      icon: <BuildIcon fontSize="small" />,
      color: '#15803d',
      onClick: () => worldId && navigate(`/w/${worldId}/manager/entry/new`),
    },
    {
      key: 'create-content',
      label: 'Create new content',
      icon: <AddIcon fontSize="small" />,
      color: '#166534',
      onClick: () => worldId && navigate(`/w/${worldId}/manager/entry/new`),
    },
    {
      key: 'collapse',
      label: 'Close sidebar',
      icon: <ChevronRightIcon fontSize="small" />,
      color: '#4b5563',
      onClick: () => toggle(),
    },
  ];

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          borderTop: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        {buttons.map((b) => (
          <Tooltip key={b.key} title={b.label} placement="left">
            <ButtonBase
              onClick={(e) => b.onClick(e.currentTarget)}
              sx={{
                py: 1.25,
                bgcolor: b.color,
                color: 'common.white',
                '&:hover': { filter: 'brightness(1.1)' },
              }}
            >
              {b.icon}
            </ButtonBase>
          </Tooltip>
        ))}
      </Box>
      <Popover
        open={!!openPopover}
        anchorEl={openPopover?.anchor ?? null}
        onClose={() => setOpenPopover(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {openPopover?.key === 'todo' && worldId && <TodoPopoverContent worldId={worldId} />}
        {openPopover?.key === 'notes' && worldId && <NotesPopoverContent worldId={worldId} />}
      </Popover>
    </>
  );
}
