export interface ChatMessage {
  id: string;
  /** Raw BBCode string, same convention as Note.body - may contain
   * [ref type="..." id="..."] mention tags. */
  text: string;
  createdAt: number;
  /** Set the first time a message is edited on the chat page (ChatDetailPage) - drives the
   * "edited" marker there. Absent on every message written before editing existed. */
  editedAt?: number;
}

export interface SessionChat {
  id: string;
  campaignId: string;
  noteId: string | null;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
