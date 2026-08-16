export type QuestStatus = 'not_started' | 'active' | 'completed' | 'failed' | 'abandoned';

export const QUEST_STATUS_OPTIONS: { value: QuestStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'abandoned', label: 'Abandoned' },
];

export const QUEST_DIFFICULTY_PRESETS = ['Easy', 'Medium', 'Hard', 'Deadly'];

/** A node in the quest/sub-quest tree. Stored directly as the backend Quest.objectives JSONB
 * blob (no schema change - see Bugs.txt #6d) - recursive so sub-quests can have their own
 * sub-sub-quests, each independently tickable. */
export interface QuestObjective {
  id: string;
  text: string;
  done: boolean;
  children: QuestObjective[];
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  status: QuestStatus;
  difficulty: string;
  location: string;
  npcs: string[];
  /** Faction ids from useFactionStore this quest is tied to. */
  relatedFactionIds: string[];
  objectives: QuestObjective[];
  rewards: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export function createObjective(text = ''): QuestObjective {
  return { id: crypto.randomUUID(), text, done: false, children: [] };
}

/** Returns a new tree with `updater` applied to the node matching `id`, wherever it is nested. */
export function updateObjectiveInTree(
  nodes: QuestObjective[],
  id: string,
  updater: (node: QuestObjective) => QuestObjective,
): QuestObjective[] {
  return nodes.map((node) =>
    node.id === id ? updater(node) : { ...node, children: updateObjectiveInTree(node.children, id, updater) },
  );
}

/** Returns a new tree with the node matching `id` removed, wherever it is nested. */
export function removeObjectiveFromTree(nodes: QuestObjective[], id: string): QuestObjective[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: removeObjectiveFromTree(node.children, id) }));
}

/** Appends a new child under the node matching `parentId`, or at the root if `parentId` is null. */
export function addObjectiveToTree(
  nodes: QuestObjective[],
  parentId: string | null,
  child: QuestObjective,
): QuestObjective[] {
  if (parentId === null) return [...nodes, child];
  return nodes.map((node) =>
    node.id === parentId
      ? { ...node, children: [...node.children, child] }
      : { ...node, children: addObjectiveToTree(node.children, parentId, child) },
  );
}

/** Recursively counts done vs. total nodes in the objective tree, for a progress bar/chip. */
export function questProgress(objectives: QuestObjective[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  const walk = (nodes: QuestObjective[]) => {
    for (const node of nodes) {
      total += 1;
      if (node.done) done += 1;
      walk(node.children);
    }
  };
  walk(objectives);
  return { done, total };
}
