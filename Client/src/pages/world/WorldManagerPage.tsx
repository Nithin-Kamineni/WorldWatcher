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
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import BadgeIcon from '@mui/icons-material/Badge';
import FolderIcon from '@mui/icons-material/Folder';
import PersonIcon from '@mui/icons-material/Person';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import TableRowsIcon from '@mui/icons-material/TableRows';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { ComingSoon } from '../../components/shell/ComingSoon';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { NpcsSection } from '../../components/dm/NpcsSection';
import { FactionsSection } from '../../components/dm/FactionsSection';
import { BastionsSection } from '../../components/dm/BastionsSection';
import { FilterChipGroup } from '../../components/dm/FilterChipGroup';
import { ArticleFolderTree } from '../../components/world/ArticleFolderTree';
import { ArticleGridStage, type ArticleGridStageHandle } from '../../components/world/ArticleGridStage';
import { ArticleTable } from '../../components/world/ArticleTable';
import { getArticleCategoryIcon } from '../../components/world/articleIcons';
import { useWorldStore, getWorldById, getPrimaryCampaignForWorld } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';
import { useNavMemoryStore } from '../../store/useNavMemoryStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../store/useCreatureStore';
import { useFactionStore, getFactionsForCampaign } from '../../store/useFactionStore';
import {
  useArticleStore,
  getArticlesForWorld,
  getFoldersForWorld,
} from '../../store/useArticleStore';
import { ARTICLE_TEMPLATES, type ArticleCategory } from '../../types/article';

type Folder =
  | 'npcs'
  | 'deities'
  | 'characters'
  | 'places'
  | 'places-countries'
  | 'places-settlements'
  | 'places-buildings'
  | 'places-dungeons'
  | 'places-bastions'
  | 'factions'
  | 'items'
  | 'articles'
  | 'all'
  | 'recent';

interface FolderItemDef {
  key: Folder;
  label: string;
  comingSoon?: boolean;
  /** Set on Places' 4 sub-items - the article categories this item's table is scoped to. */
  categories?: ArticleCategory[];
}

interface FolderGroupDef {
  group: string;
  /** Set only for groups where the heading itself is a real content view (Places' combined
   * table across all 4 categories) - clicking the heading text navigates here in addition to
   * expanding. Groups without one (People/Factions/Items & lore) just expand on click. */
  headingKey?: Folder;
  categories?: ArticleCategory[];
  items: FolderItemDef[];
}

/** Sidebar structure for the context sidebar's collapsible group headings (People/Places/
 * Factions/Items & lore) - each group expands independently on click, revealing its items.
 * Places is the one group whose heading is itself a navigable combined-categories table. */
const FOLDER_TREE: FolderGroupDef[] = [
  {
    group: 'People',
    items: [
      { key: 'npcs', label: 'NPCs' },
      { key: 'characters', label: 'Characters' },
      { key: 'deities', label: 'Deities', comingSoon: true },
    ],
  },
  {
    group: 'Places',
    headingKey: 'places',
    categories: ['country', 'settlement', 'building', 'dungeon'],
    items: [
      { key: 'places-countries', label: 'Countries', categories: ['country'] },
      { key: 'places-settlements', label: 'Settlements', categories: ['settlement'] },
      { key: 'places-buildings', label: 'Buildings', categories: ['building'] },
      { key: 'places-dungeons', label: 'Dungeons', categories: ['dungeon'] },
      { key: 'places-bastions', label: 'Bastions' },
    ],
  },
  {
    group: 'Factions',
    items: [{ key: 'factions', label: 'Factions' }],
  },
  {
    group: 'Items & lore',
    items: [{ key: 'items', label: 'Items & lore', comingSoon: true }],
  },
];

function getFolderLabel(key: Folder): string | undefined {
  for (const g of FOLDER_TREE) {
    if (g.headingKey === key) return g.group;
    const item = g.items.find((i) => i.key === key);
    if (item) return item.label;
  }
  return undefined;
}

/** The article categories a folder key is scoped to, if any - set on Places' heading and its
 * 4 children, undefined for every other folder key. */
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
  const folder = (searchParams.get('folder') as Folder | null) ?? 'articles';
  const mode = (searchParams.get('mode') as 'hybrid' | 'table' | null) ?? 'hybrid';
  const articleFolderId = searchParams.get('afid');
  const [folderSearch, setFolderSearch] = useState('');
  const [articleSearch, setArticleSearch] = useState('');
  const [articleCategoryFilter, setArticleCategoryFilter] = useState<ArticleCategory[]>([]);
  const [articleFilterBarOpen, setArticleFilterBarOpen] = useState(false);
  const gridRef = useRef<ArticleGridStageHandle>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const owner = FOLDER_TREE.find((g) => g.headingKey === folder || g.items.some((i) => i.key === folder));
    return owner ? new Set([owner.group]) : new Set();
  });
  const toggleGroupExpanded = (group: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

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

  const allArticles = useArticleStore((s) => s.articles);
  const allFolders = useArticleStore((s) => s.folders);
  const ensureSeeded = useArticleStore((s) => s.ensureSeeded);
  const addFolder = useArticleStore((s) => s.addFolder);
  const renameFolder = useArticleStore((s) => s.renameFolder);
  const deleteFolder = useArticleStore((s) => s.deleteFolder);

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
  }, [primaryCampaign, fetchCreaturesForCampaign, fetchFactionsForCampaign]);

  const npcs = primaryCampaign ? getCreaturesForCampaign(creaturesByCampaignId, primaryCampaign.id).filter((c) => c.category === 'npc') : [];
  const factions = primaryCampaign ? getFactionsForCampaign(factionsByCampaignId, primaryCampaign.id) : [];
  const worldArticles = getArticlesForWorld(allArticles, worldId);
  const worldFolders = getFoldersForWorld(allFolders, worldId);
  const worldFoldersFiltered = folderSearch.trim()
    ? worldFolders.filter((f) => f.name.toLowerCase().includes(folderSearch.trim().toLowerCase()))
    : worldFolders;

  /** The current view is either the user-defined "Articles" folder tree (scoped by
   * folderId) or one of Places' fixed-category views (heading = all 4, each child = 1) -
   * both render through the same Create/search/Hybrid-Table chrome below. */
  const placesCategories = getFolderCategories(folder);
  const isCategoryScopedView = placesCategories !== undefined;
  const visibleArticles = isCategoryScopedView
    ? worldArticles.filter((a) => placesCategories!.includes(a.category))
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
  const singleScopedCategory = placesCategories && placesCategories.length === 1 ? placesCategories[0] : undefined;
  const createEntryHref = singleScopedCategory
    ? `/w/${worldId}/manager/entry/new?type=${singleScopedCategory}`
    : `/w/${worldId}/manager/entry/new`;
  const createButtonLabel = singleScopedCategory
    ? `Create ${ARTICLE_TEMPLATES[singleScopedCategory].label}`
    : isCategoryScopedView
      ? 'Create place'
      : 'Create article';

  const savedViewEntries = [
    ...npcs.map((n) => ({ id: n.id, name: n.name, kind: 'npc' as const, category: undefined, updatedAt: n.updatedAt })),
    ...factions.map((f) => ({ id: f.id, name: f.name, kind: 'faction' as const, category: undefined, updatedAt: f.updatedAt })),
    ...worldArticles.map((a) => ({ id: a.id, name: a.name, kind: 'article' as const, category: a.category, updatedAt: a.updatedAt })),
  ];

  const setFolder = (f: Folder) =>
    setSearchParams(
      (prev) => {
        prev.set('folder', f);
        if (f !== 'articles') prev.delete('afid');
        return prev;
      },
      { replace: true },
    );
  const setMode = (m: 'hybrid' | 'table') => setSearchParams((prev) => { prev.set('mode', m); return prev; }, { replace: true });
  const setArticleFolder = (id: string | null) =>
    setSearchParams(
      (prev) => {
        prev.set('folder', 'articles');
        if (id) prev.set('afid', id);
        else prev.delete('afid');
        return prev;
      },
      { replace: true },
    );

  const openSavedViewEntry = (entry: { id: string; kind: 'npc' | 'faction' | 'article' }) => {
    if (entry.kind === 'npc') setFolder('npcs');
    else if (entry.kind === 'faction') setFolder('factions');
    else navigate(entryHref(entry.id));
  };

  const selectedArticleFolderName = articleFolderId ? worldFolders.find((f) => f.id === articleFolderId)?.name : undefined;

  /** The label for the 3rd breadcrumb crumb given the current sidebar folder - also threaded
   * onto article-open links as `from`/`fromLabel` so ArticleDetailPage can render the same
   * label (and a working back arrow) no matter which sidebar entry point was used. */
  const crumbLabel =
    folder === 'articles'
      ? selectedArticleFolderName ?? 'All articles'
      : folder === 'all'
        ? 'All entries'
        : folder === 'recent'
          ? 'Recently edited'
          : getFolderLabel(folder) ?? folder;
  const entryHref = (id: string) => `/w/${worldId}/manager/entry/${id}?from=${folder}&fromLabel=${encodeURIComponent(crumbLabel)}`;

  return (
    <SectionLayout
      worldId={worldId!}
      sidebar={
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', px: 1 }}>
            World manager
          </Typography>
          <List dense disablePadding sx={{ mb: 1 }}>
            {FOLDER_TREE.map((g) => {
              const isExpanded = expandedGroups.has(g.group);
              return (
                <Box key={g.group} sx={{ mb: 0.5 }}>
                  <ListItemButton
                    selected={g.headingKey != null && folder === g.headingKey}
                    onClick={() => {
                      if (g.headingKey) setFolder(g.headingKey);
                      setExpandedGroups((prev) => new Set(prev).add(g.group));
                    }}
                    sx={{ borderRadius: 1.5, py: 0.4 }}
                  >
                    <ListItemText
                      primary={g.group}
                      slotProps={{ primary: { variant: 'caption', sx: { fontWeight: 700, color: 'text.disabled' } } }}
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroupExpanded(g.group);
                      }}
                    >
                      {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  </ListItemButton>
                  {isExpanded && (
                    <Box sx={{ pl: 1 }}>
                      {g.items.map((item) => (
                        <ListItemButton
                          key={item.key}
                          selected={folder === item.key}
                          onClick={() => setFolder(item.key)}
                          sx={{ borderRadius: 1.5, py: 0.4 }}
                        >
                          <ListItemText primary={item.label} slotProps={{ primary: { variant: 'body2' } }} />
                          {item.comingSoon && <Chip label="Soon" size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                        </ListItemButton>
                      ))}
                    </Box>
                  )}
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
            sx={{ mb: 1 }}
          >
            Create item
          </Button>

          <Divider sx={{ my: 1 }} />

          <ArticleFolderTree
            worldId={worldId!}
            folders={worldFoldersFiltered}
            selectedFolderId={folder === 'articles' ? articleFolderId : 'none-selected'}
            onSelectFolder={(id) => setArticleFolder(id)}
            search={folderSearch}
            onSearchChange={setFolderSearch}
            onAddFolder={addFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
          />

          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>
            SAVED VIEWS
          </Typography>
          <List dense disablePadding>
            <ListItemButton selected={folder === 'all'} onClick={() => setFolder('all')} sx={{ borderRadius: 1.5, py: 0.4 }}>
              <ListItemText primary="All entries" primaryTypographyProps={{ variant: 'body2' }} />
            </ListItemButton>
            <ListItemButton selected={folder === 'recent'} onClick={() => setFolder('recent')} sx={{ borderRadius: 1.5, py: 0.4 }}>
              <ListItemText primary="Recently edited" primaryTypographyProps={{ variant: 'body2' }} />
            </ListItemButton>
          </List>
        </Box>
      }
    >
      <Breadcrumbs
        items={[
          { label: world?.name ?? '…' },
          { label: 'World Manager' },
          { label: crumbLabel },
        ]}
      />

      {folder === 'articles' || isCategoryScopedView ? (
        <>
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
                <IconButton size="small" onClick={() => gridRef.current?.advance(-1)}>
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => gridRef.current?.advance(1)}>
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
        </>
      ) : !primaryCampaign && (folder === 'npcs' || folder === 'factions' || folder === 'places-bastions') ? (
        <ComingSoon
          icon={<FolderIcon sx={{ fontSize: 56 }} />}
          title="No campaign yet"
          description="NPCs, Factions, and Bastions are tracked per-campaign today. Create a campaign in this world to start filling these in."
        />
      ) : folder === 'npcs' ? (
        <NpcsSection campaignId={primaryCampaign!.id} worldId={worldId} />
      ) : folder === 'factions' ? (
        <FactionsSection campaignId={primaryCampaign!.id} worldId={worldId} />
      ) : folder === 'places-bastions' ? (
        <BastionsSection campaignId={primaryCampaign!.id} worldId={worldId} />
      ) : folder === 'characters' ? (
        <ComingSoon
          icon={<PersonIcon sx={{ fontSize: 56 }} />}
          title="Character roster is coming soon"
          description="A per-party list of PCs - level, class, HP, and a link into each character sheet."
        />
      ) : folder === 'all' || folder === 'recent' ? (
        <SavedView
          entries={folder === 'recent' ? [...savedViewEntries].sort((a, b) => b.updatedAt - a.updatedAt) : [...savedViewEntries].sort((a, b) => a.name.localeCompare(b.name))}
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
