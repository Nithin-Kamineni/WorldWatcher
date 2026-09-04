import { useCallback, useEffect } from 'react';
import { useSessionChatStore } from '../store/useSessionChatStore';
import { usePlayUiStore, getPlayState } from '../store/usePlayUiStore';

/** One-click "put this in the session chat" for the Play page's Items sub-windows.
 *
 * The chat thread belongs to a different pane (and may not be on screen at all), so this
 * writes straight to the active SessionChat through useSessionChatStore instead of routing
 * through ChatPanel - and makes sure the thread is loaded first, since appendMessage can only
 * patch a chat that is already in the store. Returns `canSend: false` when this session was
 * started with no chat thread ("No notes thread" on the setup screen), which callers use to
 * show a disabled/hidden affordance rather than silently dropping the message. */
export function useQuickChatSend(campaignId: string): { canSend: boolean; send: (text: string) => void } {
  const byCampaignId = usePlayUiStore((s) => s.byCampaignId);
  const chats = useSessionChatStore((s) => s.chats);
  const fetchChatsForNote = useSessionChatStore((s) => s.fetchChatsForNote);
  const appendMessage = useSessionChatStore((s) => s.appendMessage);

  const { chatId, sessionNoteId } = getPlayState(byCampaignId, campaignId);

  useEffect(() => {
    if (chatId && sessionNoteId) void fetchChatsForNote(campaignId, sessionNoteId);
  }, [campaignId, chatId, sessionNoteId, fetchChatsForNote]);

  const loaded = !!chatId && chats.some((chat) => chat.id === chatId);

  const send = useCallback(
    (text: string) => {
      if (!chatId || !text.trim()) return;
      appendMessage(chatId, text);
    },
    [chatId, appendMessage],
  );

  return { canSend: loaded, send };
}
