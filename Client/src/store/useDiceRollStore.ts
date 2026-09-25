import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** How long the dice are left on the table before they fade out, in seconds. */
export const DICE_DISMISS_OPTIONS = [3, 5, 10, 20, 30] as const;
export const DEFAULT_DICE_DISMISS_SECONDS = 10;

/** The dice the 3D table can throw - every die in dice-box's default theme that reads as a
 * single physical die. d100 is left out: dice-box throws it as a percentile PAIR (tens die +
 * d10), which is a different result shape. */
export const DIE_SIDES = [4, 6, 8, 10, 12, 20] as const;
export type DieSides = (typeof DIE_SIDES)[number];

/** One throw the DM asked for. */
export interface DiceRequest {
  seq: number;
  /** dice-box notation, e.g. `1d20` or `3d6+2` - dice-box parses the modifier itself. */
  notation: string;
  /** `fresh` sweeps the table first, `add` throws onto whatever is already there - the
   * top-bar d20's "press again, get another die" behaviour. */
  mode: 'fresh' | 'add';
}

/** One group on the table as the SIMULATION reported it - `rolls` are the faces that
 * actually landed up, `total` is their sum plus the notation's modifier. */
export interface DiceGroupResult {
  sides: number;
  rolls: number[];
  modifier: number;
  total: number;
}

/** How many requests are kept for the overlay to catch up on. It only ever needs the ones
 * since it last looked, which in practice is one or two. */
const REQUEST_LOG_LIMIT = 50;
/** Settled rolls kept for the dice panel to show after the table has been swept. */
const HISTORY_LIMIT = 12;

/** THIS STORE DOES NOT ROLL ANYTHING, and that is the point.
 *
 * It is a request log. The number on a die is decided by the physics simulation in
 * DiceRollOverlay - dice-box throws a real die mesh with the real numbering, lets it come to
 * rest, and raycasts straight up to read whichever face is on top. An earlier version of this
 * feature drew a number with `rollDie(20)` and then played an animation over it; that is a
 * random number generator in a costume, and it showed - a die could land on 18 while one of
 * its neighbouring faces also read 18, because those neighbours were decorative. Nothing here
 * may ever pre-decide a result again.
 *
 * So: a press appends a request, the overlay throws every request newer than the last one it
 * handled, and the results come back from the simulation. */
interface DiceRollState {
  /** Newest last, capped at REQUEST_LOG_LIMIT. `seq` is monotonic for the session, which is
   * what lets the overlay tell "new" from "already thrown" without the store knowing anything
   * about the 3D scene. */
  requests: DiceRequest[];
  /** Bumped to ask the overlay to sweep the table. Separate from `requests` so a dismiss
   * can never be mistaken for a roll. */
  dismissCount: number;
  /** Whether dice are currently on the table. Set by the overlay, read by it to decide
   * between "throw onto an empty table" and "throw onto a table that already has dice", and
   * to decide whether the click-anywhere-to-dismiss listeners should be attached at all. */
  diceOnTable: boolean;
  /** What the simulation last reported for everything on the table, oldest group first. */
  results: DiceGroupResult[];
  /** Settled rolls, newest first. Survives the sweep - the table clears on the next click
   * anywhere, and the number the DM just rolled must not vanish with it. One entry per
   * throw onto a clean table; a die ADDED to dice already out replaces the newest entry,
   * because it is the same roll growing, not a new one. */
  history: DiceGroupResult[][];

  dismissSeconds: number;
  setDismissSeconds: (seconds: number) => void;

  /** Throw `notation` (default one d20). */
  roll: (notation?: string, mode?: DiceRequest['mode']) => void;
  dismiss: () => void;
  setDiceOnTable: (onTable: boolean) => void;
  setResults: (results: DiceGroupResult[]) => void;
  recordRoll: (results: DiceGroupResult[], replaceLatest: boolean) => void;
  clearHistory: () => void;
}

/** `count`d`sides` with an optional signed modifier, in the notation dice-box parses. */
export function diceNotation(count: number, sides: number, modifier = 0): string {
  const mod = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '';
  return `${count}d${sides}${mod}`;
}

export const useDiceRollStore = create<DiceRollState>()(
  persist(
    (set) => ({
      requests: [],
      dismissCount: 0,
      diceOnTable: false,
      results: [],
      history: [],

      dismissSeconds: DEFAULT_DICE_DISMISS_SECONDS,
      setDismissSeconds: (seconds) => set({ dismissSeconds: seconds }),

      roll: (notation = '1d20', mode = 'add') =>
        set((state) => {
          const seq = (state.requests[state.requests.length - 1]?.seq ?? 0) + 1;
          return { requests: [...state.requests, { seq, notation, mode }].slice(-REQUEST_LOG_LIMIT) };
        }),
      dismiss: () => set((state) => ({ dismissCount: state.dismissCount + 1 })),
      setDiceOnTable: (onTable) => set({ diceOnTable: onTable }),
      setResults: (results) => set({ results }),
      recordRoll: (results, replaceLatest) =>
        set((state) => ({
          history: [results, ...(replaceLatest ? state.history.slice(1) : state.history)].slice(0, HISTORY_LIMIT),
        })),
      clearHistory: () => set({ history: [] }),
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

/** Seq of the newest request, 0 if none - the overlay's watermark. */
export function latestDiceSeq(requests: DiceRequest[]): number {
  return requests[requests.length - 1]?.seq ?? 0;
}
