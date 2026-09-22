import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/EditOutlined';
import AddCircleIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import ArrowForwardIcon from '@mui/icons-material/ArrowRightAlt';
import ArticleIcon from '@mui/icons-material/DescriptionOutlined';
import BadgeIcon from '@mui/icons-material/Badge';
import GroupsIcon from '@mui/icons-material/Groups';
import PetsIcon from '@mui/icons-material/Pets';
import { su } from '../../theme/uiScale';
import { primaryForeground } from '../../theme/theme';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import { ARTICLE_TEMPLATES, type Article } from '../../types/article';
import { getArticleCategoryIcon } from './articleIcons';
import type {
  EntityRevision,
  RevisionAction,
  RevisionChange,
  RevisionEntityType,
  RevisionRetentionPolicy,
} from '../../types/revision';

/** Diameter of the timeline's action badge. It doubles as the rail's width, so the connector
 * line below it lines up with its centre without a magic offset anywhere. */
const RAIL_DOT = su(30);

interface ActionMeta {
  label: string;
  icon: ReactNode;
  /** The row's accent, resolved against the live theme - see `actionColor`. */
  tone: 'create' | 'update' | 'delete' | 'restore';
}

const ACTION_META: Record<RevisionAction, ActionMeta> = {
  create: { label: 'Created', icon: <AddCircleIcon sx={{ fontSize: su(16) }} />, tone: 'create' },
  update: { label: 'Edited', icon: <EditIcon sx={{ fontSize: su(15) }} />, tone: 'update' },
  delete: { label: 'Deleted', icon: <DeleteIcon sx={{ fontSize: su(16) }} />, tone: 'delete' },
  restore: { label: 'Restored', icon: <UndoIcon sx={{ fontSize: su(15) }} />, tone: 'restore' },
};

/** Edits are amber because an edit is the ordinary case and amber is this app's ordinary
 * accent; the other three borrow the semantic colours they already mean everywhere else.
 * Primary goes through `primaryForeground` so it stays legible as a glyph on light surfaces,
 * where the raw brand amber only reaches ~2.5:1 (see theme/theme.ts). */
function actionColor(theme: Theme, tone: ActionMeta['tone']): string {
  if (tone === 'create') return theme.palette.success.main;
  if (tone === 'delete') return theme.palette.error.main;
  if (tone === 'restore') return theme.palette.info.main;
  return primaryForeground(theme);
}

const ENTITY_META: Record<RevisionEntityType, { label: string; plural: string; icon: ReactNode }> = {
  article: { label: 'Article', plural: 'Articles', icon: <ArticleIcon sx={{ fontSize: su(14) }} /> },
  npc: { label: 'NPC', plural: 'NPCs', icon: <BadgeIcon sx={{ fontSize: su(14) }} /> },
  creature: { label: 'Creature', plural: 'Creatures', icon: <PetsIcon sx={{ fontSize: su(14) }} /> },
  faction: { label: 'Faction', plural: 'Factions', icon: <GroupsIcon sx={{ fontSize: su(14) }} /> },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const clockFormatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const fullFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' });

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(dayStart: number): string {
  const today = startOfDay(Date.now());
  if (dayStart === today) return 'Today';
  if (dayStart === today - DAY_MS) return 'Yesterday';
  return dayFormatter.format(dayStart);
}

/** The article's own category icon and label when the entry still exists, so a settlement
 * reads as a settlement rather than as a generic "Article". A deleted entry has nothing left
 * to look up and falls back to the entity-type defaults - which is also exactly what the row
 * should say about something that is no longer there. */
function entityFace(revision: EntityRevision, articles: Article[]): { label: string; icon: ReactNode } {
  const base = ENTITY_META[revision.entityType];
  if (revision.entityType !== 'article') return { label: base.label, icon: base.icon };
  const article = articles.find((a) => a.id === revision.entityId);
  if (!article) return { label: base.label, icon: base.icon };
  const template = ARTICLE_TEMPLATES[article.category];
  return {
    label: template.label,
    icon: <Box sx={{ display: 'flex', fontSize: su(14) }}>{getArticleCategoryIcon(template.icon)}</Box>,
  };
}

interface RecentChangesTimelineProps {
  worldId: string;
  revisions: EntityRevision[];
  articles: Article[];
  policy: RevisionRetentionPolicy | null;
  loading: boolean;
  restoringId: string | null;
  onRefresh: () => void;
  onRestore: (revision: EntityRevision) => Promise<string | null>;
  onOpenEntity: (revision: EntityRevision) => void;
}

/** "Recently edited", as a record of changes rather than of entities.
 *
 * Sorting entities by `updated_at` answered the one question a DM never has to ask - you know
 * you edited the Silver Hand, you want to know what you did to it at 1am and whether you can
 * put it back. So every row here is one recorded change: what moved, in one line, and the
 * button that undoes it. */
export function RecentChangesTimeline({
  worldId,
  revisions,
  articles,
  policy,
  loading,
  restoringId,
  onRefresh,
  onRestore,
  onOpenEntity,
}: RecentChangesTimelineProps) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<RevisionEntityType[]>([]);
  const [actionFilter, setActionFilter] = useState<RevisionAction[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<EntityRevision | null>(null);
  const [toast, setToast] = useState<{ severity: 'success' | 'info' | 'error'; message: string } | null>(null);

  useEffect(() => {
    // A different world is a different history; nothing about the old one's filters applies.
    setSearch('');
    setKindFilter([]);
    setActionFilter([]);
    setExpandedId(null);
  }, [worldId]);

  const kindCounts = useMemo(() => {
    const counts = new Map<RevisionEntityType, number>();
    for (const r of revisions) counts.set(r.entityType, (counts.get(r.entityType) ?? 0) + 1);
    return counts;
  }, [revisions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return revisions.filter((r) => {
      if (kindFilter.length > 0 && !kindFilter.includes(r.entityType)) return false;
      if (actionFilter.length > 0 && !actionFilter.includes(r.action)) return false;
      if (!q) return true;
      return (
        r.entityName.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.changes.some((c) => c.label.toLowerCase().includes(q))
      );
    });
  }, [revisions, search, kindFilter, actionFilter]);

  /** Grouped by calendar day. The list is already newest-first from the server, so grouping
   * in order preserves that without a second sort. */
  const groups = useMemo(() => {
    const out: { day: number; items: EntityRevision[] }[] = [];
    for (const r of filtered) {
      const day = startOfDay(r.createdAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(r);
      else out.push({ day, items: [r] });
    }
    return out;
  }, [filtered]);

  const toggle = <T,>(setter: (fn: (prev: T[]) => T[]) => void, value: T) =>
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  const handleRestore = async (revision: EntityRevision) => {
    setConfirming(null);
    const message = await onRestore(revision);
    setToast(
      message
        ? { severity: 'success', message }
        : { severity: 'error', message: `Could not restore ${revision.entityName}. Nothing was changed.` },
    );
  };

  const retentionNote = policy
    ? `Keeping every change from the last ${policy.windowHours} hours, and the last ${policy.minRows.toLocaleString()} changes however old`
    : 'Keeping your most recent changes';

  return (
    <Box>
      {/* ---------------------------------------------------------------- header */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          // A quiet amber wash rather than a flat panel: this is the page's masthead, and it
          // should read as one even before you get to the words.
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(
            theme.palette.primary.main,
            0.02,
          )} 45%, transparent 100%)`,
        }}
      >
        {loading && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 }} />
        )}
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: su(40),
              height: su(40),
              borderRadius: 2,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              color: primaryForeground(theme),
              bgcolor: alpha(theme.palette.primary.main, 0.16),
            }}
          >
            <HistoryIcon sx={{ fontSize: su(22) }} />
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Recent changes
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {revisions.length === 0
                ? 'Nothing recorded yet'
                : `${revisions.length.toLocaleString()} change${revisions.length === 1 ? '' : 's'}`}
              {' · '}
              {retentionNote}
            </Typography>
          </Box>

          <TextField
            size="small"
            placeholder="Search changes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: su(200), flexShrink: 0 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Tooltip title="Reload history">
            <span>
              <IconButton size="small" onClick={onRefresh} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {revisions.length > 0 && (
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.5, alignItems: 'center' }}>
            {(Object.keys(ENTITY_META) as RevisionEntityType[])
              .filter((kind) => (kindCounts.get(kind) ?? 0) > 0)
              .map((kind) => (
                <Chip
                  key={kind}
                  size="small"
                  icon={<Box sx={{ display: 'flex', ml: 0.75 }}>{ENTITY_META[kind].icon}</Box>}
                  label={`${ENTITY_META[kind].plural} ${kindCounts.get(kind)}`}
                  variant={kindFilter.includes(kind) ? 'filled' : 'outlined'}
                  color={kindFilter.includes(kind) ? 'primary' : 'default'}
                  onClick={() => toggle(setKindFilter, kind)}
                />
              ))}
            <Box sx={{ width: '1px', height: su(18), bgcolor: 'divider', mx: 0.75 }} />
            {(Object.keys(ACTION_META) as RevisionAction[]).map((action) => {
              const selected = actionFilter.includes(action);
              const color = actionColor(theme, ACTION_META[action].tone);
              return (
                <Chip
                  key={action}
                  size="small"
                  label={ACTION_META[action].label}
                  variant={selected ? 'filled' : 'outlined'}
                  onClick={() => toggle(setActionFilter, action)}
                  sx={{
                    borderColor: alpha(color, 0.5),
                    color: selected ? undefined : color,
                    ...(selected ? { bgcolor: alpha(color, 0.9), color: theme.palette.getContrastText(color) } : {}),
                  }}
                />
              );
            })}
          </Stack>
        )}
      </Paper>

      {/* ---------------------------------------------------------------- timeline */}
      {filtered.length === 0 ? (
        <EmptyState hasAnyHistory={revisions.length > 0} />
      ) : (
        groups.map((group) => (
          <Box key={group.day} sx={{ mb: 2.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Typography
                variant="overline"
                sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 0.8, lineHeight: 1 }}
              >
                {dayLabel(group.day)}
              </Typography>
              <Box sx={{ flexGrow: 1, height: '1px', bgcolor: 'divider' }} />
              <Typography variant="caption" color="text.disabled">
                {group.items.length}
              </Typography>
            </Stack>

            {group.items.map((revision, index) => (
              <RevisionRow
                key={revision.id}
                revision={revision}
                face={entityFace(revision, articles)}
                isLast={index === group.items.length - 1}
                expanded={expandedId === revision.id}
                restoring={restoringId === revision.id}
                onToggleExpanded={() => setExpandedId((prev) => (prev === revision.id ? null : revision.id))}
                onRestore={() => setConfirming(revision)}
                onOpen={() => onOpenEntity(revision)}
              />
            ))}
          </Box>
        ))
      )}

      <RestoreConfirmDialog
        revision={confirming}
        onCancel={() => setConfirming(null)}
        onConfirm={handleRestore}
      />

      <Snackbar
        open={toast !== null}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity ?? 'success'} variant="filled" onClose={() => setToast(null)}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ---------------------------------------------------------------------------- row

interface RevisionRowProps {
  revision: EntityRevision;
  face: { label: string; icon: ReactNode };
  isLast: boolean;
  expanded: boolean;
  restoring: boolean;
  onToggleExpanded: () => void;
  onRestore: () => void;
  onOpen: () => void;
}

function RevisionRow({
  revision,
  face,
  isLast,
  expanded,
  restoring,
  onToggleExpanded,
  onRestore,
  onOpen,
}: RevisionRowProps) {
  const theme = useTheme();
  const meta = ACTION_META[revision.action];
  const color = actionColor(theme, meta.tone);
  const deleted = revision.action === 'delete';

  return (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'stretch' }}>
      {/* The rail. The connector grows to whatever height the card ends up, so an expanded
          card keeps the line continuous instead of leaving a gap under it. */}
      <Stack sx={{ width: RAIL_DOT, flexShrink: 0, alignItems: 'center' }}>
        <Box
          sx={{
            width: RAIL_DOT,
            height: RAIL_DOT,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color,
            bgcolor: alpha(color, 0.14),
            border: 1,
            borderColor: alpha(color, 0.4),
          }}
        >
          {meta.icon}
        </Box>
        {!isLast && <Box sx={{ flexGrow: 1, width: '2px', bgcolor: 'divider', my: 0.5, borderRadius: 1 }} />}
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          mb: 1,
          p: 1.25,
          borderRadius: 2.5,
          transition: 'border-color 160ms, background-color 160ms',
          '&:hover': { borderColor: alpha(color, 0.6), bgcolor: alpha(color, 0.03) },
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            onClick={deleted ? undefined : onOpen}
            sx={{
              fontWeight: 700,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              // A deleted entry has nothing to open, so it does not pretend to be a link.
              cursor: deleted ? 'default' : 'pointer',
              color: deleted ? 'text.secondary' : 'text.primary',
              textDecoration: deleted ? 'line-through' : 'none',
              '&:hover': deleted ? {} : { textDecoration: 'underline' },
            }}
          >
            {revision.entityName || 'Untitled'}
          </Typography>
          <Chip
            size="small"
            icon={<Box sx={{ display: 'flex', ml: 0.75 }}>{face.icon}</Box>}
            label={face.label}
            variant="outlined"
            sx={{ height: su(20), flexShrink: 0, '& .MuiChip-label': { px: 0.75 } }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title={fullFormatter.format(revision.createdAt)}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
              {clockFormatter.format(revision.createdAt)} {'·'} {formatRelativeTime(revision.createdAt)}
            </Typography>
          </Tooltip>
        </Stack>

        {/* The "how it was edited" line. Tinted and rule-marked in the action's colour so the
            kind of change is legible before the sentence is read. */}
        <Box
          sx={{
            mt: 0.75,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            borderLeft: 3,
            borderColor: color,
            bgcolor: alpha(color, 0.07),
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.primary', wordBreak: 'break-word' }}>
            {revision.summary}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 0.5 }}>
          {revision.changes.length > 0 ? (
            <Button
              size="small"
              color="inherit"
              onClick={onToggleExpanded}
              endIcon={
                <ExpandMoreIcon
                  sx={{ transition: 'transform 180ms', transform: expanded ? 'rotate(180deg)' : 'none' }}
                />
              }
              sx={{ color: 'text.secondary', textTransform: 'none' }}
            >
              {revision.changes.length} field{revision.changes.length === 1 ? '' : 's'}
            </Button>
          ) : null}
          <Box sx={{ flexGrow: 1 }} />
          {revision.canRestore ? (
            <Button
              size="small"
              variant="outlined"
              disabled={restoring}
              startIcon={<RestoreIcon sx={{ fontSize: su(16) }} />}
              onClick={onRestore}
              sx={{
                textTransform: 'none',
                borderColor: alpha(color, 0.5),
                color,
                '&:hover': { borderColor: color, bgcolor: alpha(color, 0.08) },
              }}
            >
              {restoring ? 'Restoring…' : deleted ? 'Bring back' : 'Restore'}
            </Button>
          ) : (
            <Tooltip title="Nothing came before this change - it is where the entry starts.">
              <Typography variant="caption" color="text.disabled" sx={{ pr: 0.5 }}>
                Oldest version
              </Typography>
            </Tooltip>
          )}
        </Stack>

        <Collapse in={expanded} unmountOnExit>
          <Stack spacing={0.75} sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            {revision.changes.map((change) => (
              <ChangeDetail key={change.field} change={change} />
            ))}
          </Stack>
        </Collapse>
      </Paper>
    </Box>
  );
}

// ------------------------------------------------------------------- field diff

function ChangeDetail({ change }: { change: RevisionChange }) {
  const theme = useTheme();
  const removed = theme.palette.error.main;
  const added = theme.palette.success.main;

  const valueSx = (tone: string, strike: boolean) => ({
    flex: 1,
    minWidth: 0,
    px: 0.75,
    py: 0.4,
    borderRadius: 1,
    bgcolor: alpha(tone, 0.08),
    color: 'text.primary',
    wordBreak: 'break-word' as const,
    textDecoration: strike ? ('line-through' as const) : ('none' as const),
    textDecorationColor: alpha(tone, 0.7),
  });

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 0.25 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
          {change.label}
        </Typography>
        {change.kind === 'long' && change.delta !== undefined && (
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: change.delta >= 0 ? added : removed }}
          >
            {change.delta >= 0 ? '+' : ''}
            {change.delta.toLocaleString()} characters
          </Typography>
        )}
        {change.kind === 'list' && (
          <Typography variant="caption" color="text.secondary">
            {change.beforeCount ?? 0} {'→'} {change.afterCount ?? 0} items
          </Typography>
        )}
      </Stack>

      {/* Prose stacks, because two paragraphs side by side in a narrow column are unreadable;
          everything else sits on one line with the arrow between, which is how a value change
          actually reads. */}
      <Stack
        direction={change.kind === 'long' ? 'column' : 'row'}
        spacing={0.5}
        sx={{ alignItems: change.kind === 'long' ? 'stretch' : 'center' }}
      >
        <Typography variant="body2" sx={valueSx(removed, change.kind !== 'long')}>
          {change.before || <Box component="span" sx={{ color: 'text.disabled' }}>empty</Box>}
        </Typography>
        {change.kind !== 'long' && (
          <ArrowForwardIcon sx={{ fontSize: su(18), color: 'text.disabled', flexShrink: 0 }} />
        )}
        <Typography variant="body2" sx={valueSx(added, false)}>
          {change.after || <Box component="span" sx={{ color: 'text.disabled' }}>empty</Box>}
        </Typography>
      </Stack>
    </Box>
  );
}

// ------------------------------------------------------------------- confirm

function RestoreConfirmDialog({
  revision,
  onCancel,
  onConfirm,
}: {
  revision: EntityRevision | null;
  onCancel: () => void;
  onConfirm: (revision: EntityRevision) => void;
}) {
  const theme = useTheme();
  if (!revision) return null;
  const color = actionColor(theme, ACTION_META[revision.action].tone);
  const deleted = revision.action === 'delete';

  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{deleted ? 'Bring this back?' : 'Restore this version?'}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <Box component="strong">{revision.entityName || 'This entry'}</Box>{' '}
          {deleted
            ? 'will be recreated exactly as it was when it was deleted, at its original id, so anything that linked to it points at it again.'
            : 'will go back to how it was immediately before this change - the whole entry, so any later edits to it are undone too.'}
        </Typography>

        <Box
          sx={{
            px: 1.25,
            py: 0.75,
            borderRadius: 1,
            borderLeft: 3,
            borderColor: color,
            bgcolor: alpha(color, 0.07),
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Undoing {'·'} {fullFormatter.format(revision.createdAt)}
          </Typography>
          <Typography variant="body2">{revision.summary}</Typography>
        </Box>

        {/* What this change touched - NOT a prediction of what the restore will alter. A
            restore rewinds the whole entry to that moment, so if anything was edited after it,
            more than these fields move. Promising a field count here would be a promise this
            dialog has no way to keep. */}
        {revision.changes.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            This change touched {revision.changes.map((c) => c.label).join(', ')}.
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          The restore is recorded as a change of its own, so you can undo it from this same list.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={() => onConfirm(revision)} variant="contained" startIcon={<RestoreIcon />}>
          {deleted ? 'Bring back' : 'Restore'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ------------------------------------------------------------------- empty

function EmptyState({ hasAnyHistory }: { hasAnyHistory: boolean }) {
  const theme = useTheme();
  return (
    <Paper
      variant="outlined"
      sx={{ py: 6, px: 3, borderRadius: 3, textAlign: 'center', borderStyle: 'dashed' }}
    >
      <HistoryIcon sx={{ fontSize: su(48), color: alpha(theme.palette.text.primary, 0.18) }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1 }}>
        {hasAnyHistory ? 'No changes match those filters' : 'No changes recorded yet'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {hasAnyHistory
          ? 'Clear the search or a filter chip above to see the rest of the history.'
          : 'Edit an article, an NPC or a faction and it will show up here, with a button to undo it.'}
      </Typography>
    </Paper>
  );
}
