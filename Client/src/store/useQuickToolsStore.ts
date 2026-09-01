import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Backs the RightPanel's utility strip (TODO list + Quick notes icons, issue 8a) -
 * localStorage-only, same reasoning as useTokenManagerUiStore: lightweight per-user
 * scratch state that doesn't need to be shared or synced across devices. Scoped per
 * world so switching worlds doesn't mix unrelated todos/notes together. */
export interface QuickTodoItem {
  id: string;
  text: string;
  done: boolean;
}

interface QuickToolsState {
  todosByWorldId: Record<string, QuickTodoItem[]>;
  notesByWorldId: Record<string, string>;

  addTodo: (worldId: string, text: string) => void;
  toggleTodo: (worldId: string, id: string) => void;
  deleteTodo: (worldId: string, id: string) => void;
  setNotes: (worldId: string, text: string) => void;
}

export const useQuickToolsStore = create<QuickToolsState>()(
  persist(
    (set) => ({
      todosByWorldId: {},
      notesByWorldId: {},

      addTodo: (worldId, text) =>
        set((state) => ({
          todosByWorldId: {
            ...state.todosByWorldId,
            [worldId]: [...(state.todosByWorldId[worldId] ?? []), { id: crypto.randomUUID(), text, done: false }],
          },
        })),
      toggleTodo: (worldId, id) =>
        set((state) => ({
          todosByWorldId: {
            ...state.todosByWorldId,
            [worldId]: (state.todosByWorldId[worldId] ?? []).map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
          },
        })),
      deleteTodo: (worldId, id) =>
        set((state) => ({
          todosByWorldId: {
            ...state.todosByWorldId,
            [worldId]: (state.todosByWorldId[worldId] ?? []).filter((t) => t.id !== id),
          },
        })),
      setNotes: (worldId, text) =>
        set((state) => ({ notesByWorldId: { ...state.notesByWorldId, [worldId]: text } })),
    }),
    { name: 'worldwatcher-quick-tools' },
  ),
);
