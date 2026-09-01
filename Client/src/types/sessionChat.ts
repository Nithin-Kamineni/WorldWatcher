export interface ChatMessage {
  id: string;
  /** Raw BBCode string, same convention as Note.body - may contain
   * [ref type="..." id="..."] mention tags. */
  text: string;
  createdAt: number;
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
