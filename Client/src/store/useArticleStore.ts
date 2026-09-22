import { create } from 'zustand';
import type { Article, ArticleFolder, ArticleLinkedEntityType } from '../types/article';
import { apiArticleFolderToArticleFolder, apiArticleToArticle, articleFolderToApiPayload, articleToApiPayload } from '../api/adapters';
import * as articlesApi from '../api/resources/articles';

/** DB-backed now (Server/app/models/article.py, /api/articles + /api/article-folders) -
 * same optimistic-update convention as useFactionStore/useCreatureStore: local state
 * updates immediately, the API call fires in the background. Public action names/
 * signatures are unchanged from the original localStorage prototype so every consumer
 * (ArticleTypePicker/ArticleForm/ArticleGridStage/ArticleTable/ArticleFolderTree/
 * ArticleDetailPage/WorldManagerPage) keeps working with zero changes. */
interface ArticleStoreState {
  articles: Article[];
  folders: ArticleFolder[];
  loadedWorldIds: string[];

  ensureSeeded: (worldId: string) => Promise<void>;
  /** Re-reads a world's articles and folders, ignoring the once-only guard on
   * `ensureSeeded`. Restoring an edit from the World Manager's history rewrites rows
   * server-side (or brings a deleted one back) without this store ever seeing it, so
   * that is the one path that has to be able to force a reload. */
  reloadWorld: (worldId: string) => Promise<void>;
  addArticle: (article: Article) => void;
  updateArticle: (id: string, patch: Partial<Article>) => void;
  deleteArticle: (id: string) => void;

  addFolder: (folder: ArticleFolder) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
}

function seedFactionArticles(worldId: string): { folder: ArticleFolder; articles: Article[] } {
  const now = Date.now();
  const folder: ArticleFolder = { id: crypto.randomUUID(), worldId, parentId: null, name: 'Factions' };

  const seeds: Array<{ name: string; fieldValues: Record<string, string>; body: string }> = [
    {
      name: 'Silver Hand',
      fieldValues: {
        factionType: 'Merchant Guild',
        governance: 'Merchant council',
        headquarters: 'Silverport',
        goals: 'Control trade along the Sundered Coast; keep the harbor tariffs in guild hands.',
        notableMembers: 'Lady Ysolde (Guildmistress), Captain Thorne (harbor enforcer)',
      },
      body: 'The Silver Hand nominally runs Silverport\'s docks as a chartered trade guild, but every harbor tariff, warehouse lease, and smuggling tip flows through its council first.',
    },
    {
      name: 'The Ashen Circle',
      fieldValues: {
        factionType: 'Cult',
        governance: 'A single Ashen Voice, chosen by omen',
        headquarters: 'Unknown - believed to move between abandoned shrines',
        goals: 'Hasten "the Sundering to come" through quiet sabotage and stolen relics.',
        notableMembers: 'The Ashen Voice (identity unconfirmed), Archon Vael (rumored agent)',
      },
      body: 'A doomsday cult that reads every disaster as prophecy fulfilled. Most nobles dismiss them as street preachers - the Silver Hand knows better after two "accidental" warehouse fires.',
    },
    {
      name: 'The Dockside Free Company',
      fieldValues: {
        factionType: 'Mercenary Company',
        governance: 'Elected Captain, renewed yearly',
        headquarters: 'The Anchor Watch barracks, Silverport docks',
        goals: 'Sell steel to whoever pays, so long as it never turns on Silverport itself.',
        notableMembers: 'Grum the Fence (quartermaster, also runs a fencing operation on the side)',
      },
      body: 'Ex-Silver Hand marines who went independent after a pay dispute. Reliable in a fight, expensive to keep, and not above a little smuggling between contracts.',
    },
    {
      name: 'The Ember Concordat',
      fieldValues: {
        factionType: 'Religious Order',
        governance: 'A synod of five High Wardens',
        headquarters: 'The Ember Concordat chapterhouse, High Quarter',
        goals: 'Keep the old Sundering-era wards maintained; quietly police the Ashen Circle.',
        notableMembers: 'High Warden Cael',
      },
      body: 'Descended from the order that sealed the worst of the Sundering-era horrors behind ward-stones scattered across the region. Century-old grudge against the Ashen Circle, who they blame for the wards weakening.',
    },
    {
      name: 'The Nightglass Cartel',
      fieldValues: {
        factionType: 'Criminal Organization',
        governance: 'A council of masked "Glass" lieutenants',
        headquarters: 'The Warrens, Silverport',
        goals: 'Corner the black market on rare pigments and enchanted glasswork smuggled in through the docks.',
        notableMembers: 'Unknown - the Cartel\'s leadership has never been publicly identified',
      },
      body: 'Smugglers and fences operating out of Silverport\'s poorest district. The Silver Hand tolerates them so long as their cut of every shipment keeps arriving on time.',
    },
  ];

  const articles: Article[] = seeds.map((seed, index) => ({
    id: crypto.randomUUID(),
    worldId,
    folderId: folder.id,
    category: 'faction',
    name: seed.name,
    coverImageSrc: '',
    tags: ['faction'],
    visibility: 'gm',
    fieldValues: seed.fieldValues,
    body: seed.body,
    linkedEntityType: null,
    linkedEntityId: null,
    createdAt: now - index * 1000,
    updatedAt: now - index * 1000,
  }));

  return { folder, articles };
}

export const useArticleStore = create<ArticleStoreState>((set, get) => ({
  articles: [],
  folders: [],
  loadedWorldIds: [],

  ensureSeeded: async (worldId) => {
    if (get().loadedWorldIds.includes(worldId)) return;
    try {
      const [articlesPage, foldersPage] = await Promise.all([
        articlesApi.listArticles(worldId),
        articlesApi.listArticleFolders(worldId),
      ]);
      let fetchedArticles = articlesPage.items.map(apiArticleToArticle);
      let fetchedFolders = foldersPage.items.map(apiArticleFolderToArticleFolder);

      // First time this world is opened (no articles/folders at all yet) - seed the same
      // 5 sample Faction articles the old localStorage prototype seeded, but persist them
      // for real this time so they only get created once, server-side.
      if (fetchedArticles.length === 0 && fetchedFolders.length === 0) {
        const seeded = seedFactionArticles(worldId);
        await articlesApi.createArticleFolder(articleFolderToApiPayload(seeded.folder));
        await Promise.all(seeded.articles.map(async (a) => articlesApi.createArticle(await articleToApiPayload(a))));
        fetchedFolders = [seeded.folder];
        fetchedArticles = seeded.articles;
      }

      set((state) => ({
        articles: [...state.articles.filter((a) => a.worldId !== worldId), ...fetchedArticles],
        folders: [...state.folders.filter((f) => f.worldId !== worldId), ...fetchedFolders],
        loadedWorldIds: [...state.loadedWorldIds, worldId],
      }));
    } catch (err) {
      console.error(`Failed to load articles for world ${worldId}`, err);
    }
  },

  reloadWorld: async (worldId) => {
    try {
      const [articlesPage, foldersPage] = await Promise.all([
        articlesApi.listArticles(worldId),
        articlesApi.listArticleFolders(worldId),
      ]);
      set((state) => ({
        articles: [
          ...state.articles.filter((a) => a.worldId !== worldId),
          ...articlesPage.items.map(apiArticleToArticle),
        ],
        folders: [
          ...state.folders.filter((f) => f.worldId !== worldId),
          ...foldersPage.items.map(apiArticleFolderToArticleFolder),
        ],
        loadedWorldIds: state.loadedWorldIds.includes(worldId)
          ? state.loadedWorldIds
          : [...state.loadedWorldIds, worldId],
      }));
    } catch (err) {
      console.error(`Failed to reload articles for world ${worldId}`, err);
    }
  },

  addArticle: (article) => {
    set((state) => ({ articles: [...state.articles, article] }));
    articleToApiPayload(article)
      .then((payload) => articlesApi.createArticle(payload))
      .catch((err) => console.error('Failed to persist new article', err));
  },

  updateArticle: (id, patch) => {
    let merged: Article | undefined;
    set((state) => ({
      articles: state.articles.map((a) => {
        if (a.id !== id) return a;
        merged = { ...a, ...patch, updatedAt: Date.now() };
        return merged;
      }),
    }));
    if (merged) {
      articleToApiPayload(merged)
        .then((payload) => articlesApi.updateArticle(id, payload))
        .catch((err) => console.error('Failed to persist article update', err));
    }
  },

  deleteArticle: (id) => {
    set((state) => ({ articles: state.articles.filter((a) => a.id !== id) }));
    articlesApi.deleteArticle(id).catch((err) => console.error('Failed to delete article', err));
  },

  addFolder: (folder) => {
    set((state) => ({ folders: [...state.folders, folder] }));
    articlesApi.createArticleFolder(articleFolderToApiPayload(folder)).catch((err) => console.error('Failed to persist new folder', err));
  },

  renameFolder: (id, name) => {
    set((state) => ({ folders: state.folders.map((f) => (f.id === id ? { ...f, name } : f)) }));
    articlesApi.updateArticleFolder(id, { name }).catch((err) => console.error('Failed to persist folder rename', err));
  },

  deleteFolder: (id) => {
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id && f.parentId !== id),
      articles: state.articles.map((a) => (a.folderId === id ? { ...a, folderId: null } : a)),
    }));
    // Server cascades child folder rows and SET NULLs articles.folder_id on delete - matches
    // the local state update above.
    articlesApi.deleteArticleFolder(id).catch((err) => console.error('Failed to delete folder', err));
  },
}));

export function getArticlesForWorld(articles: Article[], worldId: string | undefined): Article[] {
  if (!worldId) return [];
  return articles.filter((a) => a.worldId === worldId);
}

export function getFoldersForWorld(folders: ArticleFolder[], worldId: string | undefined): ArticleFolder[] {
  if (!worldId) return [];
  return folders.filter((f) => f.worldId === worldId);
}

export function getArticleById(articles: Article[], id: string | undefined): Article | undefined {
  return articles.find((a) => a.id === id);
}

/** Articles link to entities (linkedEntityType/linkedEntityId), not the other way around -
 * this is the reverse lookup an entity card/form needs to find its own linked article, if any. */
export function getArticleForLinkedEntity(
  articles: Article[],
  worldId: string | undefined,
  type: ArticleLinkedEntityType,
  entityId: string | undefined,
): Article | undefined {
  if (!worldId || !entityId) return undefined;
  return articles.find((a) => a.worldId === worldId && a.linkedEntityType === type && a.linkedEntityId === entityId);
}
