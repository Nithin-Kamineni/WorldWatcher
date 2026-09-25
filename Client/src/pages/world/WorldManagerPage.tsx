import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Collapse from '@mui/material/Collapse';
import BadgeIcon from '@mui/icons-material/Badge';
import GroupsIcon from '@mui/icons-material/Groups';
import PublicIcon from '@mui/icons-material/Public';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import HistoryIcon from '@mui/icons-material/History';
import FolderIcon from '@mui/icons-material/Folder';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import TableRowsIcon from '@mui/icons-material/TableRows';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CasinoIcon from '@mui/icons-material/Casino';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { ComingSoon } from '../../components/shell/ComingSoon';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { NpcsSection } from '../../components/dm/NpcsSection';
import { FactionsSection } from '../../components/dm/FactionsSection';
import { CompendiumSection } from '../../components/dm/CompendiumSection';
import { BastionsSection } from '../../components/dm/BastionsSection';
import { FilterChipGroup } from '../../components/dm/FilterChipGroup';
import { ArticleGridStage, type ArticleGridStageHandle } from '../../components/world/ArticleGridStage';
import { ArticleTable } from '../../components/world/ArticleTable';
import { RecentChangesTimeline } from '../../components/world/RecentChangesTimeline';
import { WorldOverview, type OverviewGroup, type OverviewNavParams } from '../../components/world/WorldOverview';
import { PlaceBuilderDialog, type PlaceType } from '../../components/world/PlaceBuilderDialog';
import { getArticleCategoryIcon } from '../../components/world/articleIcons';
import { useWorldStore, getWorldById, getPrimaryCampaignForWorld } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';
import { useNavMemoryStore } from '../../store/useNavMemoryStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../store/useCreatureStore';
import { useFactionStore, getFactionsForCampaign } from '../../store/useFactionStore';
import { useBastionStore } from '../../store/useBastionStore';
import {
  useArticleStore,
  getArticlesForWorld,
  getFoldersForWorld,
} from '../../store/useArticleStore';
import { useRevisionStore, getRevisionsForWorld } from '../../store/useRevisionStore';
import { ARTICLE_TEMPLATES, type ArticleCategory } from '../../types/article';
import type { EntityRevision } from '../../types/revision';

type Folder =
  | 'overview'
  | 'people'
  | 'npcs'
  | 'deities'
  | 'characters'
  | 'monsters'
  | 'places'
  | 'places-countries'
  | 'places-settlements'
  | 'places-buildings'
  | 'places-dungeons'
  | 'places-geography'
  | 'places-bastions'
  | 'factions'
  | 'factions-articles'
  | 'factions-guilds'
  | 'factions-cults'
  | 'factions-noble-houses'
  | 'factions-criminal'
  | 'factions-military-orders'
  | 'factions-religious-orders'
  | 'codex'
  | 'codex-items'
  | 'codex-magic-items'
  | 'codex-spells'
  | 'codex-lore'
  | 'articles'
  | 'all'
  | 'recent';

interface FolderItemDef {
  key: Folder;
  label: string;
  comingSoon?: boolean;
  /** The article categories this item's table is scoped to - set on every sub-item backed by
   * world articles (Places' 4, People's Characters/Deities, Codex's Items/Lore). */
  categories?: ArticleCategory[];
  /** Set on the sub-items backed by the campaign Compendium's catalogs rather than by world
   * articles: Monsters under People, Spells and Magic Items under Codex. Renders a
   * <CompendiumSection> pinned to that one catalog. */
  compendium?: 'monsters' | 'spells' | 'items';
  /** Set on Factions' 6 type sub-items - the `Faction.factionType` value stored on the row,
   * which must stay in step with FACTION_TYPE_PRESETS in types/faction.ts. */
  factionType?: string;
}

interface FolderGroupDef {
  group: string;
  /** Shown at the head of the group row. The sidebar read as four near-identical grey
   * captions without these. */
  icon: ReactNode;
  /** The folder key the heading text itself navigates to. Every group has one now: clicking
   * "People", "Places", "Factions" or "Codex" shows everything in that group, the way
   * clicking Places always has, in addition to expanding the group. */
  headingKey?: Folder;
  /** The article categories the *heading's* combined table spans. Absent on Factions, whose
   * content comes from the faction store rather than from articles - its heading renders the
   * unscoped FactionsSection instead. */
  categories?: ArticleCategory[];
  /** Label for the Create button on the heading's combined view, where no single article
   * category is in scope to name it after. */
  createLabel?: string;
  /** Places only - whether to show the Place Builder promo above the table. */
  placeBuilder?: boolean;
  items: FolderItemDef[];
}

/** Sidebar structure for the context sidebar's collapsible group headings (People/Places/
 * Factions/Codex). The groups behave as an accordion - at most one is open at a time, and
 * opening one closes the other three - and each heading is itself a navigable "everything in
 * this group" view.
 *
 * Note what a group's *heading* can span: for the three article-backed groups it is a
 * combined table over `categories`, which covers the article-backed children only. Children
 * backed by something else - Bastions, and the Compendium-backed Monsters/Spells/Magic Items
 * - sit outside that combined table and are reachable as their own views, the arrangement
 * Bastions has always had under Places. */
const FOLDER_TREE: FolderGroupDef[] = [
  {
    group: 'People',
    icon: <GroupsIcon fontSize="small" />,
    headingKey: 'people',
    categories: ['character', 'deity'],
    createLabel: 'Create person',
    items: [
      { key: 'npcs', label: 'NPCs' },
      { key: 'characters', label: 'Characters', categories: ['character'] },
      { key: 'deities', label: 'Deities', categories: ['deity'] },
      { key: 'monsters', label: 'Monsters', compendium: 'monsters' },
    ],
  },
  {
    group: 'Places',
    icon: <PublicIcon fontSize="small" />,
    headingKey: 'places',
    categories: ['country', 'settlement', 'building', 'dungeon', 'geography'],
    createLabel: 'Create place',
    placeBuilder: true,
    items: [
      { key: 'places-countries', label: 'Countries', categories: ['country'] },
      { key: 'places-settlements', label: 'Settlements', categories: ['settlement'] },
      { key: 'places-buildings', label: 'Buildings', categories: ['building'] },
      { key: 'places-dungeons', label: 'Dungeons', categories: ['dungeon'] },
      { key: 'places-geography', label: 'Geography', categories: ['geography'] },
      { key: 'places-bastions', label: 'Bastions' },
    ],
  },
  {
    group: 'Factions',
    icon: <AccountBalanceIcon fontSize="small" />,
    headingKey: 'factions',
    items: [
      { key: 'factions-guilds', label: 'Guilds', factionType: 'Guild' },
      { key: 'factions-cults', label: 'Cults', factionType: 'Cult' },
      { key: 'factions-noble-houses', label: 'Noble Houses', factionType: 'Noble House' },
      { key: 'factions-criminal', label: 'Criminal Organizations', factionType: 'Criminal Organization' },
      { key: 'factions-military-orders', label: 'Military Orders', factionType: 'Military Order' },
      { key: 'factions-religious-orders', label: 'Religious Orders', factionType: 'Religious Order' },
      // The article-backed member of this group, so category-'faction' articles have a home:
      // the heading and the 6 type views all list faction *store* rows, which would otherwise
      // leave every Faction article reachable only from the Articles tree / All entries. These
      // are what the faction form's "also create a world article" checkbox and the faction
      // card's "Add article" button write.
      { key: 'factions-articles', label: 'Faction articles', categories: ['faction'] },
    ],
  },
  {
    group: 'Codex',
    icon: <MenuBookIcon fontSize="small" />,
    headingKey: 'codex',
    categories: ['item', 'spell', 'plot', 'event'],
    createLabel: 'Create codex entry',
    items: [
      { key: 'codex-items', label: 'Items', categories: ['item'] },
      { key: 'codex-magic-items', label: 'Magic Items', compendium: 'items' },
      { key: 'codex-spells', label: 'Spells', compendium: 'spells' },
      { key: 'codex-lore', label: 'Lore', categories: ['plot', 'event'] },
    ],
  },
];

/** The Places categories PlaceBuilderDialog can actually build - its own PlaceType union, so
 * TypeScript rejects this list drifting out of step with it. Geography is deliberately absent:
 * it is a Places category with no builder facets behind it. */
const PLACE_BUILDER_TYPES: PlaceType[] = ['country', 'settlement', 'building', 'dungeon'];

function getFolderLabel(key: Folder): string | undefined {
  for (const g of FOLDER_TREE) {
    if (g.headingKey === key) return g.group;
    const item = g.items.find((i) => i.key === key);
    if (item) return item.label;
  }
  return undefined;
}

/** The group a folder key belongs to, whether it is the group's heading or one of its items. */
function getFolderGroup(key: Folder): FolderGroupDef | undefined {
  return FOLDER_TREE.find((g) => g.headingKey === key || g.items.some((i) => i.key === key));
}

/** The sub-item def for a folder key - undefined for group headings and for the keys outside
 * the tree entirely (articles/all/recent). */
function getFolderItem(key: Folder): FolderItemDef | undefined {
  for (const g of FOLDER_TREE) {
    const item = g.items.find((i) => i.key === key);
    if (item) return item;
  }
  return undefined;
}

/** The article categories a folder key is scoped to, if any - undefined for keys backed by
 * something other than articles (NPCs, Bastions, the faction views, the Compendium views). */
function getFolderCategories(key: Folder): ArticleCategory[] | undefined {
  for (const g of FOLDER_TREE) {
    if (g.headingKey === key) return g.categories;
    const item = g.items.find((i) => i.key === key);
    if (item?.categories) return item.categories;
  }
  return undefined;
}

export function WorldManagerPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  /** The Overview is the World manager's landing view: search across everything, the entries
   * you were last working on, and one card per group. It replaced People, which dropped you a
   * quarter of the way into the world with no sense of the rest of it. */
  const folder = (searchParams.get('folder') as Folder | null) ?? 'overview';
  /** Set by the Overview's search: `q` pre-fills the NPC / Faction search, `open` deep-links a
   * Compendium entry to its detail. Both are dropped on any sidebar navigation. */
  const folderQuery = searchParams.get('q') ?? undefined;
  const folderOpenId = searchParams.get('open') ?? undefined;
  const mode = (searchParams.get('mode') as 'hybrid' | 'table' | null) ?? 'hybrid';
  const articleFolderId = searchParams.get('afid');
  const [articleSearch, setArticleSearch] = useState('');
  const [articleCategoryFilter, setArticleCategoryFilter] = useState<ArticleCategory[]>([]);
  const [articleFilterBarOpen, setArticleFilterBarOpen] = useState(false);
  const [placeBuilderOpen, setPlaceBuilderOpen] = useState(false);
  const gridRef = useRef<ArticleGridStageHandle>(null);
  /** Accordion, not a set of independent toggles: at most one group is open, so the nav never
   * grows past a screenful and the open group is always the one you are working in. Seeded to
   * whichever group owns the current folder, which for the default view is People. */
  const [expandedGroup, setExpandedGroup] = useState<string | null>(
    () => FOLDER_TREE.find((g) => g.headingKey === folder || g.items.some((i) => i.key === folder))?.group ?? null,
  );
  const toggleGroupExpanded = (group: string) => setExpandedGroup((prev) => (prev === group ? null : group));

  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const activeCampaignByWorldId = useNavMemoryStore((s) => s.activeCampaignByWorldId);
  const primaryCampaign =
    getCampaignById(campaigns, activeCampaignByWorldId[worldId ?? '']) ?? getPrimaryCampaignForWorld(campaigns, worldId);

  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);
  const factionsByCampaignId = useFactionStore((s) => s.factionsByCampaignId);
  const fetchFactionsForCampaign = useFactionStore((s) => s.fetchFactionsForCampaign);
  const bastionsByCampaignId = useBastionStore((s) => s.bastionsByCampaignId);
  const fetchBastionsForCampaign = useBastionStore((s) => s.fetchBastionsForCampaign);

  const revisionsByWorldId = useRevisionStore((s) => s.revisionsByWorldId);
  const revisionsLoading = useRevisionStore((s) => s.loadingWorldIds);
  const revisionPolicy = useRevisionStore((s) => s.policy);
  const restoringRevisionId = useRevisionStore((s) => s.restoringId);
  const fetchRevisions = useRevisionStore((s) => s.fetchRevisions);
  const fetchRevisionPolicy = useRevisionStore((s) => s.fetchPolicy);
  const restoreRevision = useRevisionStore((s) => s.restoreRevision);
  const reloadWorldArticles = useArticleStore((s) => s.reloadWorld);
  const reloadCreatures = useCreatureStore((s) => s.reloadCreaturesForCampaign);
  const reloadFactions = useFactionStore((s) => s.reloadFactionsForCampaign);

  const allArticles = useArticleStore((s) => s.articles);
  const allFolders = useArticleStore((s) => s.folders);
  const ensureSeeded = useArticleStore((s) => s.ensureSeeded);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (worldId) ensureSeeded(worldId);
  }, [worldId, ensureSeeded]);

  useEffect(() => {
    if (!primaryCampaign) return;
    fetchCreaturesForCampaign(primaryCampaign.id);
    fetchFactionsForCampaign(primaryCampaign.id);
    fetchBastionsForCampaign(primaryCampaign.id);
  }, [primaryCampaign, fetchCreaturesForCampaign, fetchFactionsForCampaign, fetchBastionsForCampaign]);

  /** History is written server-side as a side effect of every other store's writes, so the
   * copy held here is stale the moment anything else saves - it is refetched on every entry
   * into the view rather than cached like the content stores. The Overview reads it too, for
   * "Continue where you left off" and its activity column. */
  useEffect(() => {
    if ((folder !== 'recent' && folder !== 'overview') || !worldId) return;
    fetchRevisions(worldId);
    fetchRevisionPolicy();
  }, [folder, worldId, fetchRevisions, fetchRevisionPolicy]);

  const npcs = primaryCampaign ? getCreaturesForCampaign(creaturesByCampaignId, primaryCampaign.id).filter((c) => c.category === 'npc') : [];
  const factions = primaryCampaign ? getFactionsForCampaign(factionsByCampaignId, primaryCampaign.id) : [];
  const worldArticles = getArticlesForWorld(allArticles, worldId);
  /** Still needed without the sidebar folder tree: ArticleTable renders a Folder column, and
   * the breadcrumb names the folder when a `?afid=` deep link scopes the Articles view. */
  const worldFolders = getFoldersForWorld(allFolders, worldId);

  /** The current view is either the user-defined "Articles" folder tree (scoped by
   * folderId) or one of the tree's fixed-category views - a group heading (People = character
   * + deity, Places = all 4 place types, Codex = item/spell/plot/event) or one of their
   * children - and all of them render through the same Create/search/Hybrid-Table chrome
   * below. */
  const scopedCategories = getFolderCategories(folder);
  const isCategoryScopedView = scopedCategories !== undefined;
  const folderGroup = getFolderGroup(folder);
  const folderItem = getFolderItem(folder);
  /** Which Compendium catalog this folder shows, if it is one of the Compendium-backed
   * sub-items (People > Monsters, Codex > Spells / Magic Items). */
  const compendiumView = folderItem?.compendium;
  /** Set on Factions' 6 type sub-items; the Factions heading itself is unscoped. */
  const scopedFactionType = folderItem?.factionType;
  const isFactionsView = folder === 'factions' || scopedFactionType !== undefined;
  /** Views backed by campaign-scoped stores rather than by world articles - they need a
   * campaign in the world before they can show anything. */
  const needsCampaign = folder === 'npcs' || folder === 'places-bastions' || isFactionsView || compendiumView !== undefined;
  const visibleArticles = isCategoryScopedView
    ? worldArticles.filter((a) => scopedCategories!.includes(a.category))
    : articleFolderId
      ? worldArticles.filter((a) => a.folderId === articleFolderId)
      : worldArticles;
  const tableArticles = useMemo(() => {
    const q = articleSearch.trim().toLowerCase();
    return visibleArticles.filter((a) => {
      const matchesSearch = !q || a.name.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q));
      const matchesCategory = articleCategoryFilter.length === 0 || articleCategoryFilter.includes(a.category);
      return matchesSearch && matchesCategory;
    });
  }, [visibleArticles, articleSearch, articleCategoryFilter]);
  const categoryOptionsPresent = useMemo(() => {
    const present = new Set(visibleArticles.map((a) => a.category));
    return Array.from(present).map((c) => ({ value: c, label: ARTICLE_TEMPLATES[c].label }));
  }, [visibleArticles]);
  const singleScopedCategory = scopedCategories && scopedCategories.length === 1 ? scopedCategories[0] : undefined;
  /** The Place Builder promo belongs to Places only - the same category-scoped chrome now
   * also renders People's, Factions' and Codex's views, which have no place taxonomy to
   * build. Within Places it is further limited to the categories the builder actually
   * supports: Geography is a Places category but not a PlaceType, so its view gets the plain
   * table. Deriving the type by `find` over a PlaceType[] (rather than casting the scoped
   * ArticleCategory) is what keeps `initialType` honest - the builder would otherwise be
   * handed 'geography' and blow up looking it up in TYPE_META. */
  const buildablePlaceType = PLACE_BUILDER_TYPES.find((t) => t === singleScopedCategory);
  const showPlaceBuilder =
    isCategoryScopedView &&
    folderGroup?.placeBuilder === true &&
    (singleScopedCategory === undefined || buildablePlaceType !== undefined);
  const createEntryHref = singleScopedCategory
    ? `/w/${worldId}/manager/entry/new?type=${singleScopedCategory}`
    : `/w/${worldId}/manager/entry/new`;
  const createButtonLabel = singleScopedCategory
    ? `Create ${ARTICLE_TEMPLATES[singleScopedCategory].label}`
    : isCategoryScopedView
      ? folderGroup?.createLabel ?? 'Create entry'
      : 'Create article';

  const savedViewEntries = [
    ...npcs.map((n) => ({ id: n.id, name: n.name, kind: 'npc' as const, category: undefined, updatedAt: n.updatedAt })),
    ...factions.map((f) => ({ id: f.id, name: f.name, kind: 'faction' as const, category: undefined, updatedAt: f.updatedAt })),
    ...worldArticles.map((a) => ({ id: a.id, name: a.name, kind: 'article' as const, category: a.category, updatedAt: a.updatedAt })),
  ];

  const setFolder = (f: Folder, params?: OverviewNavParams) =>
    setSearchParams(
      (prev) => {
        prev.set('folder', f);
        if (f !== 'articles') prev.delete('afid');
        prev.delete('q');
        prev.delete('open');
        if (params?.q) prev.set('q', params.q);
        if (params?.open) prev.set('open', params.open);
        return prev;
      },
      // Leaving the Overview for a result is a real navigation - Back should return to it.
      { replace: folder !== 'overview' },
    );
  const setMode = (m: 'hybrid' | 'table') => setSearchParams((prev) => { prev.set('mode', m); return prev; }, { replace: true });
  const openSavedViewEntry = (entry: { id: string; kind: 'npc' | 'faction' | 'article' }) => {
    if (entry.kind === 'npc') setFolder('npcs');
    else if (entry.kind === 'faction') setFolder('factions');
    else navigate(entryHref(entry.id));
  };

  const bastionCount = primaryCampaign ? (bastionsByCampaignId[primaryCampaign.id] ?? []).length : 0;
  /** FOLDER_TREE with a count on every item the page already holds in memory. The Overview
   * counts the Compendium-backed items itself, from the server's totals. */
  const overviewGroups: OverviewGroup[] = FOLDER_TREE.map((g) => ({
    group: g.group,
    icon: g.icon,
    headingKey: g.headingKey ?? g.items[0].key,
    items: g.items.map((item) => ({
      key: item.key,
      label: item.label,
      compendium: item.compendium,
      categories: item.categories,
      count: item.categories
        ? worldArticles.filter((a) => item.categories!.includes(a.category)).length
        : item.factionType
          ? factions.filter((f) => f.factionType === item.factionType).length
          : item.key === 'npcs'
            ? npcs.length
            : item.key === 'places-bastions'
              ? bastionCount
              : undefined,
    })),
  }));

  const selectedArticleFolderName = articleFolderId ? worldFolders.find((f) => f.id === articleFolderId)?.name : undefined;

  /** The label for the 3rd breadcrumb crumb given the current sidebar folder - also threaded
   * onto article-open links as `from`/`fromLabel` so ArticleDetailPage can render the same
   * label (and a working back arrow) no matter which sidebar entry point was used. */
  const crumbLabel =
    folder === 'overview'
      ? 'Overview'
      : folder === 'articles'
      ? selectedArticleFolderName ?? 'All articles'
      : folder === 'all'
        ? 'All entries'
        : folder === 'recent'
          ? 'Recently edited'
          : getFolderLabel(folder) ?? folder;
  const entryHref = (id: string) => `/w/${worldId}/manager/entry/${id}?from=${folder}&fromLabel=${encodeURIComponent(crumbLabel)}`;

  /** Opens whatever a history row is about. Factions and NPCs have no detail route of their
   * own yet - the sidebar section IS their view - so they navigate the same way
   * `openSavedViewEntry` has always sent them. */
  const openRevisionEntity = (revision: EntityRevision) => {
    if (revision.entityType === 'article') navigate(entryHref(revision.entityId));
    else if (revision.entityType === 'faction') setFolder('factions');
    else setFolder('npcs');
  };

  /** Restores server-side, then re-reads whichever store owns that entity. The reload is not
   * optional: the row was rewritten (or recreated) without the content stores ever seeing it,
   * and their caches load once by design. Returns the line for the confirmation toast, or
   * null if the restore failed. */
  const handleRestoreRevision = async (revision: EntityRevision): Promise<string | null> => {
    if (!worldId) return null;
    const result = await restoreRevision(worldId, revision.id);
    if (!result) return null;

    if (revision.entityType === 'article') await reloadWorldArticles(worldId);
    else if (primaryCampaign && revision.entityType === 'faction') await reloadFactions(primaryCampaign.id);
    else if (primaryCampaign) await reloadCreatures(primaryCampaign.id);

    const name = result.entityName || 'That entry';
    if (!result.revision) return `${name} already matched that version - nothing changed.`;
    if (result.recreated) return `${name} is back, at its original id.`;
    return `${name} restored. The restore is in this list too, so you can undo it.`;
  };

  return (
    <SectionLayout
      worldId={worldId!}
      sidebar={
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <List dense disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={folder === 'overview'}
              onClick={() => {
                setFolder('overview');
                setExpandedGroup(null);
              }}
              sx={{
                borderRadius: 2,
                py: 0.6,
                pl: 1,
                gap: 0.5,
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 6,
                  bottom: 6,
                  width: 3,
                  borderRadius: 3,
                  bgcolor: folder === 'overview' ? 'primary.main' : 'transparent',
                  transition: 'background-color 160ms',
                },
                '&.Mui-selected': { bgcolor: 'action.selected' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, color: folder === 'overview' ? 'primary.main' : 'text.secondary' }}>
                <DashboardIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Overview"
                slotProps={{
                  primary: {
                    variant: 'body2',
                    sx: { fontWeight: 700, color: folder === 'overview' ? 'text.primary' : 'text.secondary' },
                  },
                }}
              />
            </ListItemButton>
          </List>
          <Divider sx={{ mx: 1, mb: 0.75 }} />
          <List dense disablePadding sx={{ mb: 1 }}>
            {FOLDER_TREE.map((g) => {
              const isExpanded = expandedGroup === g.group;
              const headingSelected = g.headingKey != null && folder === g.headingKey;
              const holdsCurrent = isExpanded || g.items.some((i) => i.key === folder);
              return (
                <Box key={g.group} sx={{ mb: 0.25 }}>
                  <ListItemButton
                    selected={headingSelected}
                    onClick={() => {
                      if (g.headingKey) setFolder(g.headingKey);
                      setExpandedGroup(g.group);
                    }}
                    sx={{
                      borderRadius: 2,
                      py: 0.6,
                      pl: 1,
                      pr: 0.5,
                      gap: 0.5,
                      // A left accent bar instead of a full-bleed highlight: it marks the
                      // active group without fighting the sub-item selection below it.
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: 6,
                        bottom: 6,
                        width: 3,
                        borderRadius: 3,
                        bgcolor: holdsCurrent ? 'primary.main' : 'transparent',
                        transition: 'background-color 160ms',
                      },
                      '&.Mui-selected': { bgcolor: 'action.selected' },
                    }}
                  >
                    <ListItemIcon
                      sx={{ minWidth: 0, color: holdsCurrent ? 'primary.main' : 'text.secondary', transition: 'color 160ms' }}
                    >
                      {g.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={g.group}
                      slotProps={{
                        primary: {
                          variant: 'body2',
                          sx: { fontWeight: 700, color: holdsCurrent ? 'text.primary' : 'text.secondary' },
                        },
                      }}
                    />
                    <IconButton
                      size="small"
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${g.group}`}
                      aria-expanded={isExpanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroupExpanded(g.group);
                      }}
                      sx={{
                        p: 0.25,
                        color: 'text.disabled',
                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 180ms',
                      }}
                    >
                      <ExpandMoreIcon fontSize="small" />
                    </IconButton>
                  </ListItemButton>
                  <Collapse in={isExpanded} unmountOnExit>
                    {/* The children hang off a hairline rail, which is what makes the
                        hierarchy readable without indenting them so far that labels truncate. */}
                    <Box sx={{ ml: 2.25, pl: 1, borderLeft: 1, borderColor: 'divider', mt: 0.25, mb: 0.5 }}>
                      {g.items.map((item) => (
                        <ListItemButton
                          key={item.key}
                          selected={folder === item.key}
                          onClick={() => setFolder(item.key)}
                          sx={{
                            borderRadius: 1.5,
                            py: 0.3,
                            minHeight: 0,
                            '&.Mui-selected': {
                              bgcolor: 'action.selected',
                              '& .MuiTypography-root': { fontWeight: 700, color: 'text.primary' },
                            },
                          }}
                        >
                          <ListItemText
                            primary={item.label}
                            slotProps={{ primary: { variant: 'body2', sx: { color: 'text.secondary' } } }}
                          />
                          {item.comingSoon && <Chip label="Soon" size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                        </ListItemButton>
                      ))}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </List>

          <Button
            fullWidth
            size="small"
            variant="outlined"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => navigate(`/w/${worldId}/manager/entry/new`)}
            sx={{ borderRadius: 2 }}
          >
            Create item
          </Button>

          {/* Pushes "Recently edited" to the floor of the panel. */}
          <Box sx={{ flexGrow: 1, minHeight: 12 }} />

          <Divider sx={{ mb: 0.5 }} />
          {/* The last survivor of the old "SAVED VIEWS" block, and not merely a convenience:
              it lists every NPC, faction and article in the world (recency-ordered, not
              truncated), so it stays the one flat cross-cutting view now that the folder tree
              and "All entries" are gone. */}
          <List dense disablePadding>
            <ListItemButton
              selected={folder === 'recent'}
              onClick={() => setFolder('recent')}
              sx={{ borderRadius: 2, py: 0.5, gap: 0.5, pl: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 0, color: folder === 'recent' ? 'primary.main' : 'text.disabled' }}>
                <HistoryIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Recently edited"
                slotProps={{ primary: { variant: 'body2', sx: { color: folder === 'recent' ? 'text.primary' : 'text.secondary' } } }}
              />
            </ListItemButton>
          </List>
        </Box>
      }
    >
      {/* The Overview's hero already names the world; a crumb trail there would say it twice. */}
      {folder !== 'overview' && (
        <Breadcrumbs
          items={[
            { label: world?.name ?? '…' },
            { label: 'World Manager', to: `/w/${worldId}/manager` },
            { label: crumbLabel },
          ]}
        />
      )}

      {folder === 'overview' ? (
        <WorldOverview
          worldId={worldId!}
          worldName={world?.name ?? ''}
          worldDescription={world?.description}
          campaignId={primaryCampaign?.id}
          groups={overviewGroups}
          articles={worldArticles}
          npcs={npcs}
          factions={factions}
          revisions={getRevisionsForWorld(revisionsByWorldId, worldId)}
          revisionsLoading={revisionsLoading[worldId ?? ''] === true}
          onNavigate={(f, params) => {
            setFolder(f as Folder, params);
            setExpandedGroup(getFolderGroup(f as Folder)?.group ?? null);
          }}
          onOpenArticle={(id) => navigate(entryHref(id))}
          onCreateArticle={(category) =>
            navigate(category ? `/w/${worldId}/manager/entry/new?type=${category}` : `/w/${worldId}/manager/entry/new`)
          }
          onOpenRevision={openRevisionEntity}
        />
      ) : folder === 'articles' || isCategoryScopedView ? (
        <>
          {showPlaceBuilder && (
            <Paper
              variant="outlined"
              onClick={() => setPlaceBuilderOpen(true)}
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 3,
                cursor: 'pointer',
                borderColor: 'primary.main',
                background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}20, ${theme.palette.background.paper} 68%)`,
                transition: '150ms',
                '&:hover': { boxShadow: 4, transform: 'translateY(-1px)' },
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.75} sx={{ alignItems: { sm: 'center' } }}>
                <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <AutoAwesomeIcon />
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>Place Builder</Typography>
                    <Chip size="small" color="primary" label="Multi-table" />
                    <Chip size="small" variant="outlined" label="Recommended" />
                    {singleScopedCategory && <Chip size="small" variant="outlined" label={`${ARTICLE_TEMPLATES[singleScopedCategory].label} selected`} />}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {singleScopedCategory
                      ? `Guide and roll a complete ${ARTICLE_TEMPLATES[singleScopedCategory].label.toLowerCase()}, then save it as an article.`
                      : 'Choose a Country, Settlement, Building, or Dungeon; guide its taxonomy and roll every detail independently.'}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<CasinoIcon />}
                  onClick={(event) => { event.stopPropagation(); setPlaceBuilderOpen(true); }}
                  sx={{ flexShrink: 0 }}
                >
                  Build place
                </Button>
              </Stack>
            </Paper>
          )}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: articleFilterBarOpen ? 1 : 2, flexWrap: 'wrap', rowGap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon fontSize="small" />}
              onClick={() => navigate(createEntryHref)}
            >
              {createButtonLabel}
            </Button>

            {mode === 'hybrid' && visibleArticles.length > 0 && (
              <Stack direction="row" spacing={0.5}>
                <IconButton size="small" aria-label="Previous entries" onClick={() => gridRef.current?.advance(-1)}>
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" aria-label="Next entries" onClick={() => gridRef.current?.advance(1)}>
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
              </Stack>
            )}

            {mode === 'table' && (
              <>
                <TextField
                  size="small"
                  placeholder="Search articles…"
                  value={articleSearch}
                  onChange={(e) => setArticleSearch(e.target.value)}
                  sx={{ width: 220 }}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
                  }}
                />
                <IconButton
                  size="small"
                  color={articleCategoryFilter.length > 0 ? 'primary' : 'default'}
                  onClick={() => setArticleFilterBarOpen((v) => !v)}
                >
                  <FilterListIcon fontSize="small" />
                </IconButton>
              </>
            )}

            <Box sx={{ flexGrow: 1 }} />

            <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_e, v) => v && setMode(v)}>
              <ToggleButton value="hybrid">
                <ViewModuleIcon fontSize="small" sx={{ mr: 0.5 }} /> Hybrid
              </ToggleButton>
              <ToggleButton value="table">
                <TableRowsIcon fontSize="small" sx={{ mr: 0.5 }} /> Table
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {mode === 'table' && articleFilterBarOpen && (
            <Box sx={{ mb: 2 }}>
              <FilterChipGroup
                label="Type"
                options={categoryOptionsPresent}
                selected={articleCategoryFilter}
                onToggle={(v) =>
                  setArticleCategoryFilter((prev) =>
                    prev.includes(v as ArticleCategory) ? prev.filter((c) => c !== v) : [...prev, v as ArticleCategory],
                  )
                }
              />
            </Box>
          )}

          {mode === 'hybrid' ? (
            <ArticleGridStage
              ref={gridRef}
              articles={visibleArticles}
              onOpen={(id) => navigate(entryHref(id))}
              onCreate={() => navigate(createEntryHref)}
            />
          ) : (
            <ArticleTable articles={tableArticles} folders={worldFolders} onOpen={(id) => navigate(entryHref(id))} />
          )}
          {showPlaceBuilder && (
            <PlaceBuilderDialog
              open={placeBuilderOpen}
              worldId={worldId!}
              campaignId={primaryCampaign?.id}
              initialType={buildablePlaceType}
              onClose={() => setPlaceBuilderOpen(false)}
              onCreated={(article) => {
                setPlaceBuilderOpen(false);
                navigate(entryHref(article.id));
              }}
            />
          )}
        </>
      ) : needsCampaign && !primaryCampaign ? (
        <ComingSoon
          icon={<FolderIcon sx={{ fontSize: 56 }} />}
          title="No campaign yet"
          description="NPCs, Monsters, Factions, Spells, Magic Items, and Bastions are tracked per-campaign today. Create a campaign in this world to start filling these in."
        />
      ) : folder === 'npcs' ? (
        <NpcsSection key={folderQuery ?? ''} campaignId={primaryCampaign!.id} worldId={worldId} initialSearch={folderQuery} />
      ) : isFactionsView ? (
        <FactionsSection
          campaignId={primaryCampaign!.id}
          worldId={worldId}
          factionType={scopedFactionType}
          heading={scopedFactionType ? folderItem!.label : undefined}
          key={folderQuery ?? ''}
          initialSearch={folderQuery}
        />
      ) : compendiumView ? (
        // Keyed by catalog so switching Monsters -> Spells remounts: otherwise React reuses
        // the one instance and the search box, page and filters carry over from the catalog
        // you just left.
        <CompendiumSection
          key={compendiumView}
          campaignId={primaryCampaign!.id}
          worldId={worldId}
          lockedView={compendiumView}
          openCreatureId={compendiumView === 'monsters' ? folderOpenId : undefined}
          openSpellId={compendiumView === 'spells' ? folderOpenId : undefined}
          openItemId={compendiumView === 'items' ? folderOpenId : undefined}
        />
      ) : folder === 'places-bastions' ? (
        <BastionsSection campaignId={primaryCampaign!.id} worldId={worldId} />
      ) : folder === 'recent' ? (
        <RecentChangesTimeline
          worldId={worldId!}
          revisions={getRevisionsForWorld(revisionsByWorldId, worldId)}
          articles={worldArticles}
          policy={revisionPolicy}
          loading={revisionsLoading[worldId ?? ''] === true}
          restoringId={restoringRevisionId}
          onRefresh={() => worldId && fetchRevisions(worldId)}
          onRestore={handleRestoreRevision}
          onOpenEntity={openRevisionEntity}
        />
      ) : folder === 'all' ? (
        <SavedView
          entries={[...savedViewEntries].sort((a, b) => a.name.localeCompare(b.name))}
          onOpen={openSavedViewEntry}
        />
      ) : (
        <ComingSoon
          icon={<BadgeIcon sx={{ fontSize: 56 }} />}
          title={`${getFolderLabel(folder) ?? folder} is coming soon`}
          description="This folder doesn't have a working feature behind it yet."
        />
      )}
    </SectionLayout>
  );
}

function SavedView({
  entries,
  onOpen,
}: {
  entries: { id: string; name: string; kind: 'npc' | 'faction' | 'article'; category?: ArticleCategory; updatedAt: number }[];
  onOpen: (entry: { id: string; kind: 'npc' | 'faction' | 'article' }) => void;
}) {
  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nothing here yet - add an NPC, a Faction, or an article to see it in this view.
      </Typography>
    );
  }
  return (
    <List>
      {entries.map((e) => (
        <ListItemButton key={`${e.kind}-${e.id}`} onClick={() => onOpen(e)} sx={{ borderRadius: 2 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            {e.category ? getArticleCategoryIcon(ARTICLE_TEMPLATES[e.category].icon) : <BadgeIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary={e.name}
            secondary={e.kind === 'npc' ? 'NPC' : e.kind === 'faction' ? 'Faction' : ARTICLE_TEMPLATES[e.category!].label}
          />
        </ListItemButton>
      ))}
    </List>
  );
}
