import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** The World Home dashboard's widgets, in render order. `comingSoon` marks the ones that
 * still show sample content rather than the DM's own data - their card titles say so. */
export const HOME_WIDGETS = [
  { id: 'tips', label: 'Tips', comingSoon: false },
  { id: 'quests', label: 'Quest progress', comingSoon: false },
  { id: 'appStats', label: 'App stats', comingSoon: false },
  { id: 'github', label: 'GitHub', comingSoon: false },
  { id: 'docker', label: 'Docker Hub', comingSoon: false },
  { id: 'calendar', label: 'Calendar', comingSoon: true },
  { id: 'weather', label: 'Weather', comingSoon: true },
] as const;

export type HomeWidgetId = (typeof HOME_WIDGETS)[number]['id'];

const WIDGET_IDS = new Set<string>(HOME_WIDGETS.map((w) => w.id));

/** Which dashboard widgets the DM switched off. Stored as the hidden set, not the shown one,
 * so a widget added later appears by default instead of silently staying off. Per browser,
 * like the other layout preferences. */
interface HomeWidgetsState {
  hidden: HomeWidgetId[];
  setWidgetVisible: (id: HomeWidgetId, visible: boolean) => void;
}

export const useHomeWidgetsStore = create<HomeWidgetsState>()(
  persist(
    (set) => ({
      hidden: [],
      setWidgetVisible: (id, visible) =>
        set((state) => ({
          hidden: visible ? state.hidden.filter((h) => h !== id) : [...new Set([...state.hidden, id])],
        })),
    }),
    {
      name: 'worldwatcher-home-widgets',
      // Drop ids of widgets that no longer exist, and anything that is not a string list.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as { hidden?: unknown };
        const hidden = Array.isArray(saved.hidden)
          ? (saved.hidden.filter((h) => typeof h === 'string' && WIDGET_IDS.has(h)) as HomeWidgetId[])
          : [];
        return { ...current, hidden };
      },
    },
  ),
);
