import { create } from 'zustand';

interface TutorialState {
  active: boolean;
  stepIndex: number;
  start: () => void;
  next: () => void;
  stop: () => void;
}

export const useTutorialStore = create<TutorialState>((set) => ({
  active: false,
  stepIndex: 0,
  start: () => set({ active: true, stepIndex: 0 }),
  next: () => set((state) => ({ stepIndex: state.stepIndex + 1 })),
  stop: () => set({ active: false, stepIndex: 0 }),
}));
