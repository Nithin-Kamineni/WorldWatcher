import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import HistoryIcon from '@mui/icons-material/History';
import BadgeIcon from '@mui/icons-material/Badge';
import GroupsIcon from '@mui/icons-material/Groups';
import PetsIcon from '@mui/icons-material/Pets';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import DiamondIcon from '@mui/icons-material/Diamond';
import EditIcon from '@mui/icons-material/EditOutlined';
import AddCircleIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import { su } from '../../theme/uiScale';
import { primaryForeground } from '../../theme/theme';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import * as creaturesApi from '../../api/resources/creatures';
import * as spellsApi from '../../api/resources/spells';
import * as itemsApi from '../../api/resources/items';
import { ARTICLE_TEMPLATES, type Article, type ArticleCategory } from '../../types/article';
import type { Creature } from '../../types/creature';
import type { Faction } from '../../types/faction';
import type { EntityRevision, RevisionAction } from '../../types/revision';
import { formatSpellLevel } from '../../types/spell';
import { getMagicItemRarityOption } from '../../types/magicItem';
import { apiCreatureToCreature, apiItemToMagicItem, apiSpellToSpell } from '../../api/adapters';
import { getArticleCategoryIcon } from './articleIcons';

/** The World manager folders the Overview can send you to. A subset of the page's own
 * `Folder` union, spelled out here so this component does not import from the page. */
export type OverviewDestination =
  | 'npcs'
  | 'factions'
  | 'monsters'
  | 'codex-spells'
  | 'codex-magic-items'
  | 'recent'
  | (string & {});

/** Extra query state a destination can be opened with: `q` pre-fills the NPC / Faction search,
 * `open` deep-links a Compendium entry straight to its detail. */
export interface OverviewNavParams {
  q?: string;
  open?: string;
}

export interface OverviewGroupItem {
  key: string;
  label: string;
  /** Counted by the page for everything it already holds in memory. */
  count?: number;
  /** Compendium-backed items are counted here instead, from the server's own totals - the
   * catalogs are paginated and never fully in memory. */
  compendium?: 'monsters' | 'spells' | 'items';
  categories?: ArticleCategory[];
}

export interface OverviewGroup {
  group: string;
  icon: ReactNode;
  headingKey: string;
  items: OverviewGroupItem[];
}

interface WorldOverviewProps {
  worldId: string;
  worldName: string;
  worldDescription?: string;
  campaignId?: string;
  groups: OverviewGroup[];
  articles: Article[];
  npcs: Creature[];
  factions: Faction[];
  revisions: EntityRevision[];
  revisionsLoading: boolean;
  onNavigate: (folder: OverviewDestination, params?: OverviewNavParams) => void;
  onOpenArticle: (articleId: string) => void;
  onCreateArticle: (category?: ArticleCategory) => void;
  onOpenRevision: (revision: EntityRevision) => void;
}

/** One accent per group, so the four cards (and every search hit / recent row that belongs
 * to one of them) can be told apart at a glance. Resolved against the live theme so they
 * hold up in both modes. */
function groupAccent(theme: Theme, group: string): string {
  switch (group) {
    case 'People':
      return primaryForeground(theme);
    case 'Places':
      return theme.palette.success.main;
    case 'Factions':
      return theme.palette.error.main;
    case 'Codex':
      return theme.palette.info.main;
    default:
      return theme.palette.text.secondary;
  }
}

function groupForCategory(category: ArticleCategory): string {
  const g = ARTICLE_TEMPLATES[category].group;
  if (g === 'People' || g === 'Places') return g;
  if (category === 'faction') return 'Factions';
  return 'Codex';
}

const ACTION_META: Record<RevisionAction, { label: string; icon: ReactNode }> = {
  create: { label: 'Created', icon: <AddCircleIcon sx={{ fontSize: su(16) }} /> },
  update: { label: 'Edited', icon: <EditIcon sx={{ fontSize: su(15) }} /> },
  delete: { label: 'Deleted', icon: <DeleteIcon sx={{ fontSize: su(16) }} /> },
  restore: { label: 'Restored', icon: <UndoIcon sx={{ fontSize: su(15) }} /> },
};

function actionColor(theme: Theme, action: RevisionAction): string {
  if (action === 'create') return theme.palette.success.main;
  if (action === 'delete') return theme.palette.error.main;
  if (action === 'restore') return theme.palette.info.main;
  return primaryForeground(theme);
}

const SEARCH_LOCAL_LIMIT = 5;
const SEARCH_REMOTE_LIMIT = 4;
/** The server also matches descriptions, so it is asked for more than is shown and the name
 * matches are ranked ahead client-side - "sil" should find Silver Dragon before Magic Missile. */
const SEARCH_REMOTE_FETCH = 12;
const CONTINUE_LIMIT = 6;
const ACTIVITY_LIMIT = 6;
/** Six cards as two even rows of three (or three of two), never five-and-a-straggler. */
const CONTINUE_COLUMNS = { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' };

/** Prefix matches ahead of substring matches, then alphabetical - "gob" should put Goblin
 * above Hobgoblin. Returns -1 for no match. */
function matchRank(name: string, q: string): number {
  const n = name.toLowerCase();
  if (n.startsWith(q)) return 0;
  if (n.split(/\s+/).some((w) => w.startsWith(q))) return 1;
  if (n.includes(q)) return 2;
  return -1;
}

function rankLocal<T>(items: T[], q: string, name: (t: T) => string, extra?: (t: T) => string[]): T[] {
  const scored: { item: T; rank: number }[] = [];
  for (const item of items) {
    let rank = matchRank(name(item), q);
    if (rank < 0 && extra?.(item).some((t) => t.toLowerCase().includes(q))) rank = 3;
    if (rank >= 0) scored.push({ item, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || name(a.item).localeCompare(name(b.item)));
  return scored.map((s) => s.item);
}

interface SearchHit {
  key: string;
  section: string;
  name: string;
  detail: string;
  icon: ReactNode;
  image?: string;
  accentGroup: string;
  activate: () => void;
}

interface RemoteHits {
  monsters: { id: string; name: string; detail: string; image: string }[];
  spells: { id: string; name: string; detail: string }[];
  items: { id: string; name: string; detail: string; image: string }[];
}

const EMPTY_REMOTE: RemoteHits = { monsters: [], spells: [], items: [] };

/** The World manager's front page: what is in this world, and the fastest way back into it.
 *
 * Built around the three reasons a DM opens World Manager - find a thing (search across every
 * kind of content at once, compendium included), pick up where they left off (Continue), and
 * see the shape of the whole world before drilling into one quarter of it (the group cards).
 * Campaign-level material - sessions, quests, weather - deliberately stays on World Home. */
export function WorldOverview({
  worldId,
  worldName,
  worldDescription,
  campaignId,
  groups,
  articles,
  npcs,
  factions,
  revisions,
  revisionsLoading,
  onNavigate,
  onOpenArticle,
  onCreateArticle,
  onOpenRevision,
}: WorldOverviewProps) {
  const theme = useTheme();

  // --- Compendium totals ---------------------------------------------------------------
  const [compendiumTotals, setCompendiumTotals] = useState<Partial<Record<'monsters' | 'spells' | 'items', number>>>({});
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    const base = { campaign_id: campaignId, scope: 'own_or_global', limit: 1, offset: 0 };
    Promise.allSettled([
      creaturesApi.listCreatures({ ...base, category: 'monster' }),
      spellsApi.listSpells(base),
      itemsApi.listItems(base),
    ]).then(([m, s, i]) => {
      if (cancelled) return;
      setCompendiumTotals({
        monsters: m.status === 'fulfilled' ? m.value.meta.total : undefined,
        spells: s.status === 'fulfilled' ? s.value.meta.total : undefined,
        items: i.status === 'fulfilled' ? i.value.meta.total : undefined,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const countFor = (item: OverviewGroupItem): number | undefined =>
    item.compendium ? compendiumTotals[item.compendium] : item.count;

  // --- Search ----------------------------------------------------------------------------
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const debouncedQ = useDebouncedValue(q, 220);
  const [remote, setRemote] = useState<RemoteHits>(EMPTY_REMOTE);
  const [remoteLoading, setRemoteLoading] = useState(false);

  useEffect(() => {
    setQuery('');
  }, [worldId]);

  /** The compendium is thousands of rows on the server, so it is searched there, a few hits
   * per catalog. A request id drops any answer that arrives after a newer query. */
  const remoteRequestId = useRef(0);
  useEffect(() => {
    if (!campaignId || debouncedQ.length < 2) {
      setRemote(EMPTY_REMOTE);
      setRemoteLoading(false);
      return;
    }
    const requestId = ++remoteRequestId.current;
    setRemoteLoading(true);
    const base = { campaign_id: campaignId, scope: 'own_or_global', q: debouncedQ, limit: SEARCH_REMOTE_FETCH, offset: 0 };
    Promise.allSettled([
      creaturesApi.listCreatures({ ...base, category: 'monster' }),
      spellsApi.listSpells(base),
      itemsApi.listItems(base),
    ]).then(([m, s, i]) => {
      if (requestId !== remoteRequestId.current) return;
      const byName = <T extends { name: string }>(rows: T[]): T[] => {
        const rank = (n: string) => {
          const r = matchRank(n, debouncedQ);
          return r < 0 ? 9 : r;
        };
        return [...rows].sort((a, b) => rank(a.name) - rank(b.name)).slice(0, SEARCH_REMOTE_LIMIT);
      };
      setRemote({
        monsters:
          m.status === 'fulfilled'
            ? byName(m.value.items.map(apiCreatureToCreature)).map((c) => ({
                id: c.id,
                name: c.name,
                detail: [[c.size, c.type].filter(Boolean).join(' '), c.cr ? `CR ${c.cr}` : ''].filter(Boolean).join(' · '),
                image: c.tokenImage,
              }))
            : [],
        spells:
          s.status === 'fulfilled'
            ? byName(s.value.items.map(apiSpellToSpell)).map((sp) => ({
                id: sp.id,
                name: sp.name,
                detail: [formatSpellLevel(sp.level), sp.school].filter(Boolean).join(' · '),
              }))
            : [],
        items:
          i.status === 'fulfilled'
            ? byName(i.value.items.map(apiItemToMagicItem)).map((it) => ({
                id: it.id,
                name: it.name,
                detail: [it.type, getMagicItemRarityOption(it.rarity).label].filter(Boolean).join(' · '),
                image: it.imageSrc,
              }))
            : [],
      });
      setRemoteLoading(false);
    });
  }, [campaignId, debouncedQ]);

  const hits = useMemo<SearchHit[]>(() => {
    if (!q) return [];
    const out: SearchHit[] = [];
    for (const a of rankLocal(articles, q, (a) => a.name, (a) => a.tags).slice(0, SEARCH_LOCAL_LIMIT)) {
      const t = ARTICLE_TEMPLATES[a.category];
      const tags = a.tags.filter((tag) => tag.toLowerCase() !== t.label.toLowerCase()).slice(0, 3);
      out.push({
        key: `article-${a.id}`,
        section: 'Articles',
        name: a.name,
        detail: tags.length ? `${t.label} · ${tags.join(', ')}` : t.label,
        icon: getArticleCategoryIcon(t.icon),
        image: a.coverImageSrc || undefined,
        accentGroup: groupForCategory(a.category),
        activate: () => onOpenArticle(a.id),
      });
    }
    for (const n of rankLocal(npcs, q, (n) => n.name).slice(0, SEARCH_LOCAL_LIMIT)) {
      out.push({
        key: `npc-${n.id}`,
        section: 'NPCs',
        name: n.name,
        detail: 'NPC',
        icon: <BadgeIcon />,
        image: n.tokenImage || undefined,
        accentGroup: 'People',
        activate: () => onNavigate('npcs', { q: n.name }),
      });
    }
    for (const f of rankLocal(factions, q, (f) => f.name).slice(0, SEARCH_LOCAL_LIMIT)) {
      out.push({
        key: `faction-${f.id}`,
        section: 'Factions',
        name: f.name,
        detail: f.factionType || 'Faction',
        icon: <GroupsIcon />,
        image: f.imageSrc || undefined,
        accentGroup: 'Factions',
        activate: () => onNavigate('factions', { q: f.name }),
      });
    }
    // Remote hits only once they answer *this* query, so a stale list never flashes in.
    if (debouncedQ === q) {
      for (const m of remote.monsters) {
        out.push({
          key: `monster-${m.id}`,
          section: 'Monsters',
          name: m.name,
          detail: m.detail || 'Monster',
          icon: <PetsIcon />,
          image: m.image || undefined,
          accentGroup: 'People',
          activate: () => onNavigate('monsters', { open: m.id }),
        });
      }
      for (const s of remote.spells) {
        out.push({
          key: `spell-${s.id}`,
          section: 'Spells',
          name: s.name,
          detail: s.detail || 'Spell',
          icon: <AutoStoriesIcon />,
          accentGroup: 'Codex',
          activate: () => onNavigate('codex-spells', { open: s.id }),
        });
      }
      for (const it of remote.items) {
        out.push({
          key: `item-${it.id}`,
          section: 'Magic Items',
          name: it.name,
          detail: it.detail || 'Magic item',
          icon: <DiamondIcon />,
          image: it.image || undefined,
          accentGroup: 'Codex',
          activate: () => onNavigate('codex-magic-items', { open: it.id }),
        });
      }
    }
    return out;
  }, [q, debouncedQ, articles, npcs, factions, remote, onNavigate, onOpenArticle]);

  useEffect(() => {
    setActiveIndex(0);
  }, [q]);

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      hits[activeIndex]?.activate();
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  // --- Continue --------------------------------------------------------------------------
  /** Latest change per entity, newest first, dropping anything whose latest change deleted it
   * or that has since vanished from the stores. With no history yet (a world that predates
   * edit tracking) it falls back to the entities' own `updatedAt`. */
  const continueItems = useMemo(() => {
    type Card = { key: string; name: string; label: string; icon: ReactNode; image?: string; group: string; at: number; open: () => void };
    const articleById = new Map(articles.map((a) => [a.id, a]));
    const npcById = new Map(npcs.map((n) => [n.id, n]));
    const factionById = new Map(factions.map((f) => [f.id, f]));

    const toCard = (type: string, id: string, at: number): Card | null => {
      if (type === 'article') {
        const a = articleById.get(id);
        if (!a) return null;
        const t = ARTICLE_TEMPLATES[a.category];
        return { key: `a-${id}`, name: a.name, label: t.label, icon: getArticleCategoryIcon(t.icon), image: a.coverImageSrc || undefined, group: groupForCategory(a.category), at, open: () => onOpenArticle(id) };
      }
      if (type === 'npc') {
        const n = npcById.get(id);
        if (!n) return null;
        return { key: `n-${id}`, name: n.name, label: 'NPC', icon: <BadgeIcon />, image: n.tokenImage || undefined, group: 'People', at, open: () => onNavigate('npcs', { q: n.name }) };
      }
      if (type === 'faction') {
        const f = factionById.get(id);
        if (!f) return null;
        return { key: `f-${id}`, name: f.name, label: f.factionType || 'Faction', icon: <GroupsIcon />, image: f.imageSrc || undefined, group: 'Factions', at, open: () => onNavigate('factions', { q: f.name }) };
      }
      return null;
    };

    const seen = new Set<string>();
    const out: Card[] = [];
    for (const r of revisions) {
      const k = `${r.entityType}:${r.entityId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (r.action === 'delete') continue;
      const card = toCard(r.entityType, r.entityId, r.createdAt);
      if (card) out.push(card);
      if (out.length >= CONTINUE_LIMIT) return out;
    }
    if (out.length > 0) return out;

    const fallback = [
      ...articles.map((a) => ({ type: 'article', id: a.id, at: a.updatedAt })),
      ...npcs.map((n) => ({ type: 'npc', id: n.id, at: n.updatedAt })),
      ...factions.map((f) => ({ type: 'faction', id: f.id, at: f.updatedAt })),
    ].sort((a, b) => b.at - a.at);
    for (const e of fallback) {
      const card = toCard(e.type, e.id, e.at);
      if (card) out.push(card);
      if (out.length >= CONTINUE_LIMIT) break;
    }
    return out;
  }, [revisions, articles, npcs, factions, onNavigate, onOpenArticle]);

  // --- Header stats ------------------------------------------------------------------------
  const totalEntries = articles.length + npcs.length + factions.length;
  const lastEdit = revisions[0]?.createdAt ?? continueItems[0]?.at;
  const isEmptyWorld = totalEntries === 0;

  // --- Create menu (per group card) ---------------------------------------------------------
  const [createMenu, setCreateMenu] = useState<{ anchor: HTMLElement; categories: ArticleCategory[] } | null>(null);

  const heroTint = alpha(primaryForeground(theme), theme.palette.mode === 'dark' ? 0.14 : 0.1);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 4 }}>
      {/* ---------------------------------------------------------------- Hero + search */}
      <Paper
        variant="outlined"
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
          px: { xs: 2, sm: 3.5 },
          py: { xs: 2.5, sm: 3.5 },
          background: `radial-gradient(120% 140% at 100% 0%, ${heroTint}, transparent 60%), ${theme.palette.background.paper}`,
        }}
      >
        <Typography
          variant="overline"
          sx={{ color: primaryForeground(theme), fontWeight: 800, letterSpacing: '0.14em', lineHeight: 1.4 }}
        >
          World Manager
        </Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 850, lineHeight: 1.15, mt: 0.25 }}>
          {worldName}
        </Typography>
        {worldDescription && (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>
            {worldDescription}
          </Typography>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap', color: 'text.secondary' }}>
          <StatPill value={totalEntries} label={totalEntries === 1 ? 'entry' : 'entries'} />
          <StatPill value={articles.length} label={articles.length === 1 ? 'article' : 'articles'} />
          <StatPill value={npcs.length} label={npcs.length === 1 ? 'NPC' : 'NPCs'} />
          <StatPill value={factions.length} label={factions.length === 1 ? 'faction' : 'factions'} />
          {lastEdit && (
            <Typography variant="body2" sx={{ alignSelf: 'center', ml: 0.5 }}>
              Last edit {formatRelativeTime(lastEdit)}
            </Typography>
          )}
        </Stack>

        {/* Search */}
        <Box
          sx={{
            mt: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 2,
            py: 1.1,
            borderRadius: 3,
            border: 1,
            borderColor: q ? 'primary.main' : 'divider',
            bgcolor: 'background.default',
            boxShadow: q ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}` : 'none',
            transition: 'border-color 150ms, box-shadow 150ms',
            '&:focus-within': {
              borderColor: 'primary.main',
              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}`,
            },
          }}
        >
          <SearchIcon sx={{ color: 'text.secondary' }} />
          <InputBase
            inputRef={inputRef}
            autoFocus
            fullWidth
            placeholder="Search people, places, factions, lore, monsters, spells, items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            inputProps={{ 'aria-label': 'Search this world' }}
            sx={{ fontSize: '1.05rem' }}
          />
          {remoteLoading && q && <CircularProgress size={su(18)} />}
          {query && (
            <IconButton
              size="small"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {q && (
          <SearchResults
            hits={hits}
            activeIndex={activeIndex}
            onHover={setActiveIndex}
            loading={remoteLoading || debouncedQ !== q}
            query={query.trim()}
            onCreate={() => onCreateArticle()}
          />
        )}
      </Paper>

      {/* ---------------------------------------------------------------- Continue */}
      {!q && (
        <Box>
          <SectionHeading
            title="Continue where you left off"
            action={
              revisions.length > 0 ? (
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => onNavigate('recent')}>
                  Full history
                </Button>
              ) : undefined
            }
          />
          {isEmptyWorld ? (
            <EmptyWorld onCreate={onCreateArticle} />
          ) : revisionsLoading && continueItems.length === 0 ? (
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: CONTINUE_COLUMNS }}>
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} variant="rounded" height={su(84)} sx={{ borderRadius: 3 }} />
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: CONTINUE_COLUMNS }}>
              {continueItems.map((c) => (
                <ButtonBase
                  key={c.key}
                  onClick={c.open}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 1.5,
                    p: 1.25,
                    pr: 1.75,
                    borderRadius: 3,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    textAlign: 'left',
                    transition: 'transform 150ms, box-shadow 150ms, border-color 150ms',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.shadows[4],
                      borderColor: groupAccent(theme, c.group),
                    },
                    '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                  }}
                >
                  <EntityThumb image={c.image} icon={c.icon} accent={groupAccent(theme, c.group)} size={su(60)} />
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="subtitle2" noWrap sx={{ fontWeight: 750 }}>
                      {c.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {c.label}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" noWrap component="div">
                      {formatRelativeTime(c.at)}
                    </Typography>
                  </Box>
                </ButtonBase>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* ---------------------------------------------------------------- Groups + activity */}
      {!q && (
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(280px, 1fr)' },
            alignItems: 'start',
          }}
        >
          <Box>
            <SectionHeading title="Your world" />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
              {groups.map((g) => {
                const accent = groupAccent(theme, g.group);
                const creatable = Array.from(new Set(g.items.flatMap((i) => i.categories ?? [])));
                const total = g.items.reduce((sum, i) => sum + (i.compendium ? 0 : (i.count ?? 0)), 0);
                return (
                  <Paper
                    key={g.group}
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'border-color 150ms, box-shadow 150ms',
                      '&:hover': { borderColor: alpha(accent, 0.6), boxShadow: theme.shadows[2] },
                    }}
                  >
                    <Box sx={{ height: '3px', bgcolor: accent }} />
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 2, pt: 1.75, pb: 1 }}>
                      <ButtonBase
                        onClick={() => onNavigate(g.headingKey)}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1, minWidth: 0, justifyContent: 'flex-start', borderRadius: 2, textAlign: 'left' }}
                      >
                        <Box
                          sx={{
                            width: su(44),
                            height: su(44),
                            borderRadius: 2.5,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            color: accent,
                            bgcolor: alpha(accent, 0.14),
                            '& svg': { fontSize: su(26) },
                          }}
                        >
                          {g.icon}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                            {g.group}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {total > 0
                              ? `${total.toLocaleString()} ${total === 1 ? 'entry' : 'entries'}`
                              : g.items.some((i) => i.compendium)
                                ? 'Compendium only so far'
                                : 'Nothing yet'}
                          </Typography>
                        </Box>
                      </ButtonBase>
                      {creatable.length > 0 && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AddIcon fontSize="small" />}
                          onClick={(e) =>
                            creatable.length === 1
                              ? onCreateArticle(creatable[0])
                              : setCreateMenu({ anchor: e.currentTarget, categories: creatable })
                          }
                          sx={{ flexShrink: 0, borderRadius: 2, borderColor: alpha(accent, 0.5), color: accent, '&:hover': { borderColor: accent, bgcolor: alpha(accent, 0.08) } }}
                        >
                          New
                        </Button>
                      )}
                    </Stack>
                    <Box sx={{ px: 1, pb: 1.25 }}>
                      {g.items.map((item) => {
                        const count = countFor(item);
                        return (
                          <ButtonBase
                            key={item.key}
                            onClick={() => onNavigate(item.key)}
                            sx={{
                              width: '100%',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              px: 1,
                              py: 0.6,
                              borderRadius: 1.5,
                              '&:hover': { bgcolor: 'action.hover', '& .ov-arrow': { opacity: 1, transform: 'translateX(0)' } },
                            }}
                          >
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {item.label}
                              {item.compendium && (
                                <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.75 }}>
                                  compendium
                                </Typography>
                              )}
                            </Typography>
                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
                              {count === undefined ? (
                                <Skeleton variant="text" width={su(28)} />
                              ) : (
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: count === 0 ? 'text.disabled' : 'text.primary' }}
                                >
                                  {count.toLocaleString()}
                                </Typography>
                              )}
                              <ArrowForwardIcon
                                className="ov-arrow"
                                sx={{ fontSize: su(16), color: accent, opacity: 0, transform: 'translateX(-4px)', transition: '150ms' }}
                              />
                            </Stack>
                          </ButtonBase>
                        );
                      })}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Box>

          {/* Recent activity */}
          <Box>
            <SectionHeading
              title="Recent activity"
              action={
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => onNavigate('recent')}>
                  See all
                </Button>
              }
            />
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
              {revisionsLoading && revisions.length === 0 ? (
                <Box sx={{ p: 2 }}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} variant="text" height={su(44)} />
                  ))}
                </Box>
              ) : revisions.length === 0 ? (
                <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', px: 3, py: 4, color: 'text.secondary' }}>
                  <HistoryIcon sx={{ fontSize: su(36), color: 'text.disabled' }} />
                  <Typography variant="body2">No edits recorded yet. Changes to articles, NPCs and factions show up here, with an undo.</Typography>
                </Stack>
              ) : (
                revisions.slice(0, ACTIVITY_LIMIT).map((r, idx) => {
                  const meta = ACTION_META[r.action];
                  const color = actionColor(theme, r.action);
                  return (
                    <ButtonBase
                      key={r.id}
                      onClick={() => onOpenRevision(r)}
                      disabled={r.action === 'delete'}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'flex-start',
                        gap: 1.25,
                        px: 1.75,
                        py: 1.25,
                        textAlign: 'left',
                        borderTop: idx === 0 ? 0 : 1,
                        borderColor: 'divider',
                        '&:hover': { bgcolor: 'action.hover' },
                        '&.Mui-disabled': { opacity: 1 },
                      }}
                    >
                      <Box
                        sx={{
                          width: su(28),
                          height: su(28),
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          mt: 0.25,
                          color,
                          bgcolor: alpha(color, 0.14),
                        }}
                      >
                        {meta.icon}
                      </Box>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 700, textDecoration: r.action === 'delete' ? 'line-through' : 'none' }}>
                            {r.entityName || 'Untitled'}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                            {formatRelativeTime(r.createdAt)}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" component="div" noWrap>
                          <Box component="span" sx={{ color, fontWeight: 700 }}>
                            {meta.label}
                          </Box>
                          {r.summary ? ` · ${r.summary}` : ''}
                        </Typography>
                      </Box>
                    </ButtonBase>
                  );
                })
              )}
            </Paper>
          </Box>
        </Box>
      )}

      <Menu
        anchorEl={createMenu?.anchor ?? null}
        open={createMenu != null}
        onClose={() => setCreateMenu(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {createMenu?.categories.map((c) => (
          <MenuItem
            key={c}
            onClick={() => {
              setCreateMenu(null);
              onCreateArticle(c);
            }}
          >
            <ListItemIcon sx={{ '& svg': { fontSize: su(20) } }}>{getArticleCategoryIcon(ARTICLE_TEMPLATES[c].icon)}</ListItemIcon>
            <ListItemText primary={ARTICLE_TEMPLATES[c].label} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 0.5,
        px: 1.25,
        py: 0.35,
        borderRadius: 999,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString()}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.25, minHeight: su(32) }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      {action}
    </Stack>
  );
}

function EntityThumb({ image, icon, accent, size }: { image?: string; icon: ReactNode; accent: string; size: number }) {
  const [broken, setBroken] = useState(false);
  const showImage = image && !broken;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 2,
        flexShrink: 0,
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        color: accent,
        bgcolor: alpha(accent, 0.14),
        '& svg': { fontSize: Math.round(size * 0.46) },
      }}
    >
      {showImage ? (
        <Box component="img" src={image} alt="" onError={() => setBroken(true)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        icon
      )}
    </Box>
  );
}

function SearchResults({
  hits,
  activeIndex,
  onHover,
  loading,
  query,
  onCreate,
}: {
  hits: SearchHit[];
  activeIndex: number;
  onHover: (i: number) => void;
  loading: boolean;
  query: string;
  onCreate: () => void;
}) {
  const theme = useTheme();
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (hits.length === 0) {
    return (
      <Stack spacing={1.25} sx={{ alignItems: 'center', textAlign: 'center', py: 4, color: 'text.secondary' }}>
        {loading ? (
          <CircularProgress size={su(24)} />
        ) : (
          <>
            <Typography variant="body2">Nothing in this world matches “{query}”.</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
              Create an entry
            </Button>
          </>
        )}
      </Stack>
    );
  }

  const sections: { name: string; items: { hit: SearchHit; index: number }[] }[] = [];
  hits.forEach((hit, index) => {
    const last = sections[sections.length - 1];
    if (last && last.name === hit.section) last.items.push({ hit, index });
    else sections.push({ name: hit.section, items: [{ hit, index }] });
  });

  return (
    <Box sx={{ mt: 1.5, maxHeight: '55vh', overflowY: 'auto', mx: -1, px: 1 }}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        {sections.map((s) => (
          <Box key={s.name}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ fontWeight: 800, letterSpacing: '0.1em', px: 1, display: 'block', lineHeight: 2 }}
            >
              {s.name}
            </Typography>
            {s.items.map(({ hit, index }) => {
              const active = index === activeIndex;
              const accent = groupAccent(theme, hit.accentGroup);
              return (
                <ButtonBase
                  key={hit.key}
                  ref={active ? activeRef : undefined}
                  onClick={hit.activate}
                  onMouseMove={() => !active && onHover(index)}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 1.25,
                    px: 1,
                    py: 0.75,
                    borderRadius: 2,
                    textAlign: 'left',
                    bgcolor: active ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                  }}
                >
                  <EntityThumb image={hit.image} icon={hit.icon} accent={accent} size={su(40)} />
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                      {hit.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {hit.detail}
                    </Typography>
                  </Box>
                  {active && <KeyboardReturnIcon sx={{ fontSize: su(18), color: 'text.disabled', flexShrink: 0 }} />}
                </ButtonBase>
              );
            })}
          </Box>
        ))}
      </Box>
      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1, pt: 1.5, color: 'text.disabled' }}>
          <CircularProgress size={su(14)} color="inherit" />
          <Typography variant="caption">Searching the compendium…</Typography>
        </Stack>
      )}
    </Box>
  );
}

/** A brand-new world has nothing to continue, so this slot becomes the first step instead. */
function EmptyWorld({ onCreate }: { onCreate: (category?: ArticleCategory) => void }) {
  const theme = useTheme();
  const starters: ArticleCategory[] = ['character', 'settlement', 'country', 'plot'];
  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 3, borderStyle: 'dashed', px: 3, py: 3.5, textAlign: 'center' }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
        This world is a blank page
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        Start with whoever or wherever the first session needs.
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        {starters.map((c) => {
          const accent = groupAccent(theme, groupForCategory(c));
          return (
            <Button
              key={c}
              variant="outlined"
              startIcon={getArticleCategoryIcon(ARTICLE_TEMPLATES[c].icon)}
              onClick={() => onCreate(c)}
              sx={{ borderRadius: 2, color: accent, borderColor: alpha(accent, 0.5), '&:hover': { borderColor: accent, bgcolor: alpha(accent, 0.08) } }}
            >
              New {ARTICLE_TEMPLATES[c].label.toLowerCase()}
            </Button>
          );
        })}
      </Stack>
    </Paper>
  );
}
