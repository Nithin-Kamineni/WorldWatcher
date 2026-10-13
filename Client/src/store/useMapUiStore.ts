import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Map-page UI preferences - how wide the DM dragged the sidebar panel, and whether fog shows
 * only the acting creature's sight during combat. Per browser, not per map: these are about
 * the DM's screen and habits, not about any one floor. */

/** The sidebar sections that remember their own width - Reference and Tokens start wide
 * because they carry a stat block / tabbed lists, the rest start narrow. */
export type MapSidebarWidthKey = 'tokens' | 'floors' | 'initiative' | 'dice' | 'reference';

/** Rendered px bounds for a dragged panel. Kept loose on purpose: a stat block wants room,
 * a floor list does not, and the DM is the judge of that. */
export const MAP_SIDEBAR_MIN_WIDTH = 160;
export const MAP_SIDEBAR_MAX_WIDTH = 900;

interface MapUiState {
  sidebarWidths: Partial<Record<MapSidebarWidthKey, number>>;
  /** During an active encounter, draw live line of sight for the current combatant only. */
  turnPerspectiveFog: boolean;
  /** Whether the sidebar panel is folded down to its icon rail. Here rather than in
   * MapSidebar so the page's Toggle Sidebar shortcut can flip it too. */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (key: MapSidebarWidthKey, width: number) => void;
  resetSidebarWidth: (key: MapSidebarWidthKey) => void;
  setTurnPerspectiveFog: (on: boolean) => void;
}

export const useMapUiStore = create<MapUiState>()(
  persist(
    (set) => ({
      sidebarWidths: {},
      turnPerspectiveFog: true,
      sidebarCollapsed: true,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarWidth: (key, width) =>
        set((state) => ({
          sidebarWidths: {
            ...state.sidebarWidths,
            [key]: Math.round(Math.min(MAP_SIDEBAR_MAX_WIDTH, Math.max(MAP_SIDEBAR_MIN_WIDTH, width))),
          },
        })),
      resetSidebarWidth: (key) =>
        set((state) => {
          const next = { ...state.sidebarWidths };
          delete next[key];
          return { sidebarWidths: next };
        }),
      setTurnPerspectiveFog: (on) => set({ turnPerspectiveFog: on }),
    }),
    {
      name: 'worldwatcher-map-ui',
      // Tolerate a record from an older shape: anything unrecognised falls back to defaults.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as { sidebarWidths?: unknown; turnPerspectiveFog?: unknown; sidebarCollapsed?: unknown };
        const widths: Partial<Record<MapSidebarWidthKey, number>> = {};
        if (saved.sidebarWidths && typeof saved.sidebarWidths === 'object') {
          for (const [k, v] of Object.entries(saved.sidebarWidths as Record<string, unknown>)) {
            if (typeof v === 'number' && Number.isFinite(v)) widths[k as MapSidebarWidthKey] = v;
          }
        }
        return {
          ...current,
          sidebarWidths: widths,
          turnPerspectiveFog:
            typeof saved.turnPerspectiveFog === 'boolean' ? saved.turnPerspectiveFog : current.turnPerspectiveFog,
          sidebarCollapsed:
            typeof saved.sidebarCollapsed === 'boolean' ? saved.sidebarCollapsed : current.sidebarCollapsed,
        };
      },
    },
  ),
);
