import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** How long the dice are left on the table before they fade out, in seconds. */
export const DICE_DISMISS_OPTIONS = [3, 5, 10, 20, 30] as const;
export const DEFAULT_DICE_DISMISS_SECONDS = 10;

/** THIS STORE DOES NOT ROLL ANYTHING, and that is the point.
 *
 * It is a request counter. The number on a die is decided by the physics simulation in
 * DiceRollOverlay - dice-box throws a real d20 mesh with the real numbering, lets it come to
 * rest, and raycasts straight up to read whichever face is on top. An earlier version of this
 * feature drew a number with `rollDie(20)` and then played an animation over it; that is a
 * random number generator in a costume, and it showed - a die could land on 18 while one of
 * its neighbouring faces also read 18, because those neighbours were decorative. Nothing here
 * may ever pre-decide a result again.
 *
 * So: a press increments `requestCount`, the overlay throws that many more dice, and the
 * results come back from the simulation. */
interface DiceRollState {
  /** Monotonic count of presses. The overlay tracks how many it has thrown and throws the
   * difference, which is what makes a burst of taps into a burst of dice without the store
   * needing to know anything about the 3D scene. */
  requestCount: number;
  /** Bumped to ask the overlay to sweep the table. Separate from `requestCount` so a dismiss
   * can never be mistaken for a roll. */
  dismissCount: number;
  /** Whether dice are currently on the table. Set by the overlay, read by it to decide
   * between "throw onto an empty table" and "throw onto a table that already has dice", and
   * to decide whether the click-anywhere-to-dismiss listeners should be attached at all. */
  diceOnTable: boolean;
  /** What the simulation last reported, newest roll last - the faces that actually landed up. */
  results: number[];

  dismissSeconds: number;
  setDismissSeconds: (seconds: number) => void;

  roll: () => void;
  dismiss: () => void;
  setDiceOnTable: (onTable: boolean) => void;
  setResults: (results: number[]) => void;
}

export const useDiceRollStore = create<DiceRollState>()(
  persist(
    (set) => ({
      requestCount: 0,
      dismissCount: 0,
      diceOnTable: false,
      results: [],

      dismissSeconds: DEFAULT_DICE_DISMISS_SECONDS,
      setDismissSeconds: (seconds) => set({ dismissSeconds: seconds }),

      roll: () => set((state) => ({ requestCount: state.requestCount + 1 })),
      dismiss: () => set((state) => ({ dismissCount: state.dismissCount + 1 })),
      setDiceOnTable: (onTable) => set({ diceOnTable: onTable }),
      setResults: (results) => set({ results }),
    }),
    {
      name: 'worldwatcher-dice',
      // Only the preference survives a reload. Dice on the table are a moment, not state.
      partialize: (state) => ({ dismissSeconds: state.dismissSeconds }),
      // A hand-edited or pre-feature record must not be able to leave dice up forever or
      // flash them away instantly.
      merge: (persisted, current) => {
        const saved = (persisted as { dismissSeconds?: unknown } | undefined)?.dismissSeconds;
        const valid = typeof saved === 'number' && Number.isFinite(saved) && saved >= 1 && saved <= 120;
        return { ...current, dismissSeconds: valid ? saved : DEFAULT_DICE_DISMISS_SECONDS };
      },
    },
  ),
);
