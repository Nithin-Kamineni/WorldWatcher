import { create } from 'zustand';

export type RightPanelSelection =
  | { type: 'faction'; id: string; campaignId: string }
  | { type: 'quest'; id: string; campaignId: string }
  | { type: 'npc'; id: string; campaignId: string }
  | { type: 'encounter'; id: string; campaignId: string }
  | { type: 'map'; id: string; campaignId: string }
  | { type: 'bastion'; id: string; campaignId: string }
  | null;

interface ShellStoreState {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;

  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  selection: RightPanelSelection;
  select: (selection: RightPanelSelection) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  newWorldDialogOpen: boolean;
  setNewWorldDialogOpen: (open: boolean) => void;
  newCampaignDialogOpen: boolean;
  setNewCampaignDialogOpen: (open: boolean) => void;
}

export const useShellStore = create<ShellStoreState>((set) => ({
  paletteOpen: false,
  setPaletteOpen: (open) => set({ paletteOpen: open }),

  rightPanelOpen: false,
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  selection: null,
  select: (selection) => set((state) => ({ selection, rightPanelOpen: selection ? true : state.rightPanelOpen })),

  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  newWorldDialogOpen: false,
  setNewWorldDialogOpen: (open) => set({ newWorldDialogOpen: open }),
  newCampaignDialogOpen: false,
  setNewCampaignDialogOpen: (open) => set({ newCampaignDialogOpen: open }),
}));
