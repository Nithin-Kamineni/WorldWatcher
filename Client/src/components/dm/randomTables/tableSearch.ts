import type { Category } from '../../../types/category';
import type { RandomTable } from '../../../types/randomTable';
import type { Tag } from '../../../types/tag';

/** Shared, purely client-side search + facet-count helpers for the random table library.
 *
 * Both random-table surfaces (the Encounters page's browse view and the Play page's Random
 * Tables sub-window) load the whole library up front - the category browser already needs it
 * to draw per-branch counts - so text search and tag/format faceting run here rather than as
 * another round trip. Keeping it local is what makes the search feel instant and, more
 * importantly, is what lets every suggestion and facet carry a live "how many tables are under
 * this" count: a server-side `q` would have already thrown the non-matching tables away. */

/** Lowercased, accent-stripped form every search comparison happens in - exported so callers
 * matching their own text (category names, tag labels) fold it the same way the index does. */
export function normalizeSearchText(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

/** Whitespace-separated tokens, all of which must match somewhere ("goblin forest" finds a
 * "Forest Encounters" table described as goblin-infested). */
export function queryTokens(query: string): string[] {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean);
}

/** The minimum an entity needs to be searched, faceted and counted here.
 *
 * Task 11.3 asked for ONE browse screen over both random tables and encounters. Rather than
 * duplicate the index/facet/count logic per kind, the helpers below take this structural
 * shape, which both RandomTable and Encounter already satisfy - a table adds sourceBook and
 * triggerSituation, an encounter adds neither, and both are read optionally. */
export interface BrowsableEntity {
  id: string;
  name: string;
  description?: string | null;
  categoryId: string | null;
  tagIds: string[];
  /** Table-only, folded into the match text when present. */
  sourceBook?: string | null;
  triggerSituation?: string | null;
}

function haystack(table: BrowsableEntity, categoryLabel: string, tagLabels: string): string {
  return normalizeSearchText([table.name, table.description ?? '', table.sourceBook ?? '', table.triggerSituation ?? '', categoryLabel, tagLabels].join(' \u0000 '));
}

export interface TableSearchIndex {
  /** Entity id -> the text every token is matched against. */
  text: Map<string, string>;
}

/** Builds the match text once per (library, category, tag) change so typing a character does
 * not re-derive category paths and tag labels for every table in the library. */
export function buildTableSearchIndex(tables: BrowsableEntity[], flatCategories: Category[], tags: Tag[]): TableSearchIndex {
  const categoryById = new Map(flatCategories.map((category) => [category.id, category]));
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const pathCache = new Map<string, string>();
  const pathFor = (categoryId: string | null): string => {
    if (!categoryId) return '';
    const cached = pathCache.get(categoryId);
    if (cached !== undefined) return cached;
    const parts: string[] = [];
    const seen = new Set<string>();
    let node = categoryById.get(categoryId);
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      parts.unshift(node.name);
      node = node.parentId ? categoryById.get(node.parentId) : undefined;
    }
    const path = parts.join(' ');
    pathCache.set(categoryId, path);
    return path;
  };

  const text = new Map<string, string>();
  tables.forEach((table) => {
    const tagLabels = table.tagIds
      .map((id) => {
        const tag = tagById.get(id);
        return tag ? `${tag.namespace}:${tag.value} ${tag.label}` : '';
      })
      .join(' ');
    text.set(table.id, haystack(table, pathFor(table.categoryId), tagLabels));
  });
  return { text };
}

/** How wrong a typed token is allowed to be before it stops matching a word. Short tokens get
 * no slack (at 3 letters an edit-distance of 1 matches almost anything), longer ones get more,
 * which is what makes "wheather" find "Weather" without "orc" finding "arc". */
function allowedEdits(token: string): number {
  if (token.length <= 3) return 0;
  if (token.length <= 6) return 1;
  return 2;
}

/** Levenshtein distance, abandoned as soon as it is certainly greater than `max` - the fuzzy
 * pass runs over the whole library's words, so bailing early matters more than the exact
 * distance once it is out of range. */
function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  if (a === b) return true;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      row.push(value);
      if (value < best) best = value;
    }
    if (best > max) return false;
    prev = row;
  }
  return prev[b.length] <= max;
}

function textWords(text: string): string[] {
  return text.split(/[^a-z0-9]+/).filter(Boolean);
}

/** A token matches a haystack if it is a substring of it (the strict rule) or, failing that, is
 * a near-miss of one of its words - typo tolerance, so a misspelling still finds the table. */
export function tokenMatchesFuzzy(token: string, text: string): boolean {
  if (text.includes(token)) return true;
  const max = allowedEdits(token);
  if (max === 0) return false;
  return textWords(text).some((word) => {
    // Compare against the head of a longer word so a typo'd token still matches a word it is a
    // prefix of ("wheather" vs "weathervane"), not only whole words of the same length.
    if (word.length > token.length + max) return withinEdits(token, word.slice(0, token.length + max), max);
    return withinEdits(token, word, max);
  });
}

/** Every token must match. Runs a strict substring pass first and only falls back to the fuzzy
 * pass when that finds nothing, so a correctly-typed query is never diluted by near-misses and
 * the (much more expensive) edit-distance work only happens when it can actually help. */
export function filterTablesByQuery<T extends BrowsableEntity>(tables: T[], query: string, index: TableSearchIndex): T[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return tables;
  const strict = tables.filter((table) => {
    const text = index.text.get(table.id);
    if (!text) return false;
    return tokens.every((token) => text.includes(token));
  });
  if (strict.length > 0 || !tokens.some((token) => allowedEdits(token) > 0)) return strict;
  return tables.filter((table) => {
    const text = index.text.get(table.id);
    if (!text) return false;
    return tokens.every((token) => tokenMatchesFuzzy(token, text));
  });
}

/** Ranks matches for the search dropdown. Kept as its own entry point (callers that have no
 * usage signals to offer), but implemented on top of the blended ranker so the suggestion order
 * and the result-list order can never disagree. */
export function rankTablesByQuery(tables: RandomTable[], query: string, signals: TableUsefulnessSignals = {}): RandomTable[] {
  return rankTablesByUsefulness(tables, query, signals);
}

/** How useful an item has proven to be, for any of the Items window's five kinds - see
 * rankByUsefulness. */
export interface UsefulnessSignals {
  /** Per-campaign, per-kind use/open counters, from useItemUsageStore. */
  usage?: Record<string, { rolls: number; opens: number; lastUsedAt: number }>;
  /** Items the DM has pinned in the Play window - an explicit "keep this to hand". */
  pinnedIds?: Iterable<string>;
  /** Overrides "now" in the recency term - tests and stable snapshots. */
  now?: number;
}

/** The table-flavoured signals: everything above, plus the campaign whose homebrew should
 * outrank the shared system library. */
export interface TableUsefulnessSignals extends UsefulnessSignals {
  campaignId?: string;
}

const DAY_MS = 86_400_000;

/** How well a table matches the typed query, 0 (no match at all) to 100 (its name *is* the
 * query). The tiers are the ones rankTablesByQuery already used, spread out far enough that a
 * usefulness bonus can reorder ties and near-ties without ever letting a barely-relevant
 * favourite jump ahead of a direct name hit. */
function relevanceScore(table: { name: string }, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const name = normalizeSearchText(table.name);
  const query = tokens.join(' ');
  if (name === query) return 100;
  if (tokens.every((token) => name.startsWith(token))) return 88;
  if (tokens.every((token) => name.split(/\s+/).some((word) => word.startsWith(token)))) return 76;
  if (tokens.every((token) => name.includes(token))) return 64;
  // A fuzzy name hit still beats an exact hit that only landed on description/category/tags -
  // a typo'd table name is what the DM was reaching for.
  if (tokens.every((token) => tokenMatchesFuzzy(token, name))) return 50;
  return 30;
}

/** "How likely is this the item the DM wants", independent of what they typed, from usage
 * alone - capped well below one relevance tier so it breaks ties and nudges neighbours rather
 * than overriding the text match. A recorded *use* counts for more than a mere open (rolling a
 * table, running an encounter, reading a stat block open is real work at the table), and both
 * decay in favour of items touched recently. Kind-agnostic: every Items sub-window scores its
 * rows through this. */
export function usageScore(id: string, signals: UsefulnessSignals): number {
  const pinned = signals.pinnedIds instanceof Set ? signals.pinnedIds : new Set(signals.pinnedIds ?? []);
  const use = signals.usage?.[id];
  const now = signals.now ?? Date.now();
  let score = 0;
  if (use) {
    score += Math.min(14, 4.2 * Math.log1p(use.rolls * 2 + use.opens));
    const age = now - use.lastUsedAt;
    if (age < DAY_MS) score += 6;
    else if (age < 7 * DAY_MS) score += 3.5;
    else if (age < 30 * DAY_MS) score += 1.5;
  }
  if (pinned.has(id)) score += 8;
  return score;
}

/** The table-specific half on top of usageScore: whose library it came from, and whether it is
 * a finished table or a bare imported stub. */
export function usefulnessScore(table: RandomTable, signals: TableUsefulnessSignals): number {
  let score = usageScore(table.id, signals);
  // Homebrew written for this campaign is more likely to be wanted than a generic system table.
  if (signals.campaignId && table.campaignId === signals.campaignId) score += 3;
  else if (!table.isSystem) score += 1.5;
  // A table someone bothered to describe or give a trigger situation to is a finished, usable
  // table; a bare imported stub usually is not.
  if (table.description) score += 1;
  if (table.triggerSituation) score += 1;
  return score;
}

/** The ordering every non-table Items sub-window uses, for search results *and* for plain
 * browsing - the generic sibling of rankTablesByUsefulness, on the same relevance scale.
 *
 * Alphabetical order is the one thing a mid-session DM never wants: it puts "Abandoned Cart
 * Contents" above the weather table they roll every in-game morning, and "Acolyte" above the
 * boss the party is currently fighting. So with a query, rows are ranked by how well they match
 * blended with how useful they have proven; with no query, purely by usefulness, and only then
 * alphabetically - which is what lets a sub-window opened mid-fight lead with something the DM
 * actually wants instead of an empty pane (checklist I-P8). */
export function rankByUsefulness<T extends { id: string; name: string }>(items: T[], query: string, signals: UsefulnessSignals = {}): T[] {
  const tokens = queryTokens(query);
  return items
    .map((item) => ({ item, score: relevanceScore(item, tokens) + usageScore(item.id, signals) }))
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map((scored) => scored.item);
}

/** The ordering used by both random-table surfaces, for search results *and* for plain browsing.
 *
 * Alphabetical order is the one thing a mid-session DM never wants: it puts "Abandoned Cart
 * Contents" above the weather table they roll every in-game morning. So with a query, results
 * are ranked by how well they match blended with how useful the table has proven to be; with no
 * query, purely by usefulness, and only then alphabetically. Ties therefore stay stable and the
 * list still reads predictably. */
export function rankTablesByUsefulness(tables: RandomTable[], query: string, signals: TableUsefulnessSignals = {}): RandomTable[] {
  const tokens = queryTokens(query);
  const scored = tables.map((table) => ({
    table,
    score: relevanceScore(table, tokens) + usefulnessScore(table, signals),
  }));
  return scored.sort((a, b) => b.score - a.score || a.table.name.localeCompare(b.table.name)).map((entry) => entry.table);
}

/** Ranking for a kind that carries no usage signals of its own (encounters, in the unified
 * browse). Same relevance tiers as the table ranker, so the two halves of one result list are
 * ordered on the same scale, then alphabetical - there is nothing else to go on. */
export function rankByRelevance<T extends BrowsableEntity>(entities: T[], query: string): T[] {
  const tokens = queryTokens(query);
  return entities
    .map((entity) => ({ entity, score: relevanceScore(entity, tokens) }))
    .sort((a, b) => b.score - a.score || a.entity.name.localeCompare(b.entity.name))
    .map((scored) => scored.entity);
}

/** Every id in the selected category's subtree (the category itself included), or null when
 * nothing is selected - i.e. "no category restriction". */
export function subtreeCategoryIds(flatCategories: Category[], selectedId: string | null): Set<string> | null {
  if (!selectedId) return null;
  const ids = new Set<string>([selectedId]);
  let changed = true;
  while (changed) {
    changed = false;
    flatCategories.forEach((category) => {
      if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    });
  }
  return ids;
}

/** Tables per category, rolled up into every ancestor so a parent branch reports its whole
 * subtree rather than only the tables filed directly on it. */
export function computeCategoryCounts(tables: BrowsableEntity[], flatCategories: Category[]): Map<string, number> {
  const counts = new Map<string, number>();
  const byId = new Map(flatCategories.map((category) => [category.id, category]));
  tables.forEach((table) => {
    let category = table.categoryId ? byId.get(table.categoryId) : undefined;
    const seen = new Set<string>();
    while (category && !seen.has(category.id)) {
      seen.add(category.id);
      counts.set(category.id, (counts.get(category.id) ?? 0) + 1);
      category = category.parentId ? byId.get(category.parentId) : undefined;
    }
  });
  return counts;
}

/** Tables carrying each tag. */
export function computeTagCounts(tables: BrowsableEntity[]): Map<string, number> {
  const counts = new Map<string, number>();
  tables.forEach((table) => {
    table.tagIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  });
  return counts;
}

/** Tables using each format. */
export function computeFormatCounts(tables: RandomTable[]): Map<string, number> {
  const counts = new Map<string, number>();
  tables.forEach((table) => counts.set(table.formatId, (counts.get(table.formatId) ?? 0) + 1));
  return counts;
}
