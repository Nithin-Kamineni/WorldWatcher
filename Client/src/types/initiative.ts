export type InitiativeStatus = 'idle' | 'rolling' | 'active';

export interface InitiativeEntry {
  id: string;
  /** PlacedToken.id this entry tracks */
  tokenId: string;
  /** raw d20 roll, editable */
  baseRoll: number;
  /** DEX (or other) modifier applied on top of the base roll */
  modifier: number;
  /** derived total = baseRoll + modifier, kept in sync whenever baseRoll changes */
  roll: number;
  /**
   * Once the encounter is active, entries are locked by default and can only be edited
   * after clicking the unlock icon. Entries added mid-encounter start unlocked so the DM
   * can adjust their freshly-rolled initiative. Meaningless while status is 'rolling'.
   */
  locked?: boolean;
}

export interface InitiativeState {
  status: InitiativeStatus;
  entries: InitiativeEntry[];
  currentEntryId: string | null;
  round: number;
}

export const DEFAULT_INITIATIVE_STATE: InitiativeState = {
  status: 'idle',
  entries: [],
  currentEntryId: null,
  round: 1,
};
