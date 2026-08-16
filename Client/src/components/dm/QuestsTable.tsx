import { useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import LinearProgress from '@mui/material/LinearProgress';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import {
  QUEST_STATUS_OPTIONS,
  addObjectiveToTree,
  createObjective,
  questProgress,
  removeObjectiveFromTree,
  updateObjectiveInTree,
  type Quest,
  type QuestObjective,
} from '../../types/quest';

interface QuestsTableProps {
  quests: Quest[];
  onEdit: (quest: Quest) => void;
  onDelete: (quest: Quest) => void;
  onUpdateQuest: (quest: Quest) => void;
}

const STATUS_COLOR: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  not_started: 'default',
  active: 'info',
  completed: 'success',
  failed: 'error',
  abandoned: 'warning',
};

function statusLabel(status: string): string {
  return QUEST_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function ObjectiveRow({
  node,
  depth,
  onToggleDone,
  onRename,
  onAddChild,
  onDelete,
}: {
  node: QuestObjective;
  depth: number;
  onToggleDone: (id: string) => void;
  onRename: (id: string, text: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', pl: depth * 3, py: 0.25 }}>
        <IconButton size="small" onClick={() => setExpanded((v) => !v)} sx={{ visibility: hasChildren ? 'visible' : 'hidden' }}>
          {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
        <Checkbox size="small" checked={node.done} onChange={() => onToggleDone(node.id)} />
        <TextField
          variant="standard"
          value={node.text}
          onChange={(e) => onRename(node.id, e.target.value)}
          placeholder="Sub-quest…"
          sx={{ flexGrow: 1, textDecoration: node.done ? 'line-through' : 'none' }}
          slotProps={{ input: { disableUnderline: true } }}
        />
        <Tooltip title="Add sub-quest">
          <IconButton size="small" onClick={() => onAddChild(node.id)}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Remove">
          <IconButton size="small" onClick={() => onDelete(node.id)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {hasChildren && (
        <Collapse in={expanded}>
          {node.children.map((child) => (
            <ObjectiveRow
              key={child.id}
              node={child}
              depth={depth + 1}
              onToggleDone={onToggleDone}
              onRename={onRename}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
}

function QuestDetailRow({ quest, onUpdateQuest }: { quest: Quest; onUpdateQuest: (quest: Quest) => void }) {
  const setObjectives = (objectives: QuestObjective[]) => onUpdateQuest({ ...quest, objectives });

  return (
    <Box sx={{ p: 2, pl: 6 }}>
      {quest.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
          {quest.description}
        </Typography>
      )}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Sub-quests
      </Typography>
      {quest.objectives.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          No sub-quests yet.
        </Typography>
      )}
      {quest.objectives.map((node) => (
        <ObjectiveRow
          key={node.id}
          node={node}
          depth={0}
          onToggleDone={(id) =>
            setObjectives(updateObjectiveInTree(quest.objectives, id, (n) => ({ ...n, done: !n.done })))
          }
          onRename={(id, text) => setObjectives(updateObjectiveInTree(quest.objectives, id, (n) => ({ ...n, text })))}
          onAddChild={(parentId) => setObjectives(addObjectiveToTree(quest.objectives, parentId, createObjective()))}
          onDelete={(id) => setObjectives(removeObjectiveFromTree(quest.objectives, id))}
        />
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        sx={{ mt: 1 }}
        onClick={() => setObjectives(addObjectiveToTree(quest.objectives, null, createObjective()))}
      >
        Add sub-quest
      </Button>
    </Box>
  );
}

function QuestRow({
  quest,
  onEdit,
  onDelete,
  onUpdateQuest,
}: {
  quest: Quest;
  onEdit: (quest: Quest) => void;
  onDelete: (quest: Quest) => void;
  onUpdateQuest: (quest: Quest) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { done, total } = questProgress(quest.objectives);
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <TableRow hover sx={{ '& > td': { borderBottom: expanded ? 0 : undefined } }}>
        <TableCell sx={{ width: 40 }}>
          <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ maxWidth: 220 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 600, cursor: 'pointer' }}
            onClick={() => setExpanded((v) => !v)}
          >
            {quest.name}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip label={statusLabel(quest.status)} size="small" color={STATUS_COLOR[quest.status] ?? 'default'} />
        </TableCell>
        <TableCell>{quest.difficulty || '—'}</TableCell>
        <TableCell>{quest.location || '—'}</TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', maxWidth: 180 }}>
            {quest.npcs.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                —
              </Typography>
            ) : (
              quest.npcs.map((npc) => <Chip key={npc} label={npc} size="small" variant="outlined" />)
            )}
          </Stack>
        </TableCell>
        <TableCell sx={{ width: 140 }}>
          {total === 0 ? (
            <Typography variant="caption" color="text.secondary">
              No sub-quests
            </Typography>
          ) : (
            <Stack spacing={0.25}>
              <LinearProgress variant="determinate" value={progressPct} sx={{ borderRadius: 1, height: 6 }} />
              <Typography variant="caption" color="text.secondary">
                {done}/{total} done
              </Typography>
            </Stack>
          )}
        </TableCell>
        <TableCell sx={{ maxWidth: 160 }}>
          <Typography variant="body2" noWrap>
            {quest.rewards || '—'}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Tooltip title="Edit quest">
            <IconButton size="small" onClick={() => onEdit(quest)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete quest">
            <IconButton size="small" onClick={() => onDelete(quest)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={9} sx={{ p: 0, borderBottom: expanded ? undefined : 0 }}>
          <Collapse in={expanded}>
            <QuestDetailRow quest={quest} onUpdateQuest={onUpdateQuest} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export function QuestsTable({ quests, onEdit, onDelete, onUpdateQuest }: QuestsTableProps) {
  return (
    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 700 }} />
            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Difficulty</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>NPCs</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Progress</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Reward</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {quests.map((quest) => (
            <QuestRow key={quest.id} quest={quest} onEdit={onEdit} onDelete={onDelete} onUpdateQuest={onUpdateQuest} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
