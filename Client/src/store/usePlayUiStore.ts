import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CampaignPlayState {
  /** The session-prep Note this run is anchored to - owns which chat threads are listed
   * (SessionChat.noteId) even if `displayedNoteId` is currently showing something else. */
  sessionNoteId: string | null;
  /** Which Note's body is currently shown in the Session Notes panel - defaults to
   * `sessionNoteId`, but can be swapped to a Narrative note for reference without disturbing
   * the active chat thread. */
  displayedNoteId: string | null;
  /** Optional - the setup screen's "No notes thread" option leaves this null, and the
   * workspace still opens (a Chat-kind pane just renders its blurred "choose or start" prompt
   * until one is picked). */
  chatId: string | null;
}

const DEFAULT_CAMPAIGN_STATE: CampaignPlayState = {
  sessionNoteId: null,
  displayedNoteId: null,
  chatId: null,
};

interface PlayUiState {
  byCampaignId: Record<string, CampaignPlayState>;
  /** Finalizes the setup screen's single-page pick (session note + optional chat thread) and
   * enters the workspace. */
  startSession: (campaignId: string, noteId: string, chatId: string | null) => void;
  /** Swaps which note the Session Notes panel displays, independent of the anchor session. */
  setDisplayedNote: (campaignId: string, noteId: string) => void;
  setChat: (campaignId: string, chatId: string) => void;
  /** Reopens the setup screen ("back to setup") - clears the session/note/chat. */
  endSession: (campaignId: string) => void;
}

export const usePlayUiStore = create<PlayUiState>()(
  persist(
    (set) => ({
      byCampaignId: {},

      startSession: (campaignId, noteId, chatId) =>
        set((state) => ({
          byCampaignId: {
            ...state.byCampaignId,
            [campaignId]: {
              ...(state.byCampaignId[campaignId] ?? DEFAULT_CAMPAIGN_STATE),
              sessionNoteId: noteId,
              displayedNoteId: noteId,
              chatId,
            },
          },
        })),

      setDisplayedNote: (campaignId, noteId) =>
        set((state) => ({
          byCampaignId: {
            ...state.byCampaignId,
            [campaignId]: { ...(state.byCampaignId[campaignId] ?? DEFAULT_CAMPAIGN_STATE), displayedNoteId: noteId },
          },
        })),

      setChat: (campaignId, chatId) =>
        set((state) => ({
          byCampaignId: {
            ...state.byCampaignId,
            [campaignId]: { ...(state.byCampaignId[campaignId] ?? DEFAULT_CAMPAIGN_STATE), chatId },
          },
        })),

      endSession: (campaignId) =>
        set((state) => ({
          byCampaignId: { ...state.byCampaignId, [campaignId]: DEFAULT_CAMPAIGN_STATE },
        })),
    }),
    { name: 'worldwatcher-play-ui' },
  ),
);

export function getPlayState(byCampaignId: Record<string, CampaignPlayState>, campaignId: string | undefined): CampaignPlayState {
  if (!campaignId) return DEFAULT_CAMPAIGN_STATE;
  return byCampaignId[campaignId] ?? DEFAULT_CAMPAIGN_STATE;
}
