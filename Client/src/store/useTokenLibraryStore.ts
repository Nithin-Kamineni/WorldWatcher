import { create } from 'zustand';
import type { TokenDefinition } from '../types/token';
import { apiTokenToTokenDefinition, tokenDefinitionToApiPayload } from '../api/adapters';
import * as tokenLibraryApi from '../api/resources/tokenLibrary';

interface TokenLibraryState {
  tokens: TokenDefinition[];
  loaded: boolean;
  fetchTokenLibrary: () => Promise<void>;
  addToken: (token: TokenDefinition) => void;
  updateToken: (token: TokenDefinition) => void;
  deleteToken: (tokenId: string) => void;
  toggleFavorite: (tokenId: string) => void;
}

export const useTokenLibraryStore = create<TokenLibraryState>((set, get) => ({
  tokens: [],
  loaded: false,

  fetchTokenLibrary: async () => {
    if (get().loaded) return;
    try {
      const page = await tokenLibraryApi.listTokenLibrary();
      set({ tokens: page.items.map(apiTokenToTokenDefinition), loaded: true });
    } catch (err) {
      console.error('Failed to load token library', err);
    }
  },

  addToken: (token) => {
    set((state) => ({ tokens: [...state.tokens, token] }));
    tokenDefinitionToApiPayload(token)
      .then((payload) => tokenLibraryApi.createTokenLibraryEntry({ id: token.id, ...payload }))
      .catch((err) => console.error('Failed to persist new token', err));
  },

  updateToken: (token) => {
    set((state) => ({
      tokens: state.tokens.map((existing) => (existing.id === token.id ? token : existing)),
    }));
    tokenDefinitionToApiPayload(token)
      .then((payload) => tokenLibraryApi.updateTokenLibraryEntry(token.id, payload))
      .catch((err) => console.error('Failed to persist token update', err));
  },

  deleteToken: (tokenId) => {
    set((state) => ({
      tokens: state.tokens.filter((existing) => existing.id !== tokenId),
    }));
    tokenLibraryApi.deleteTokenLibraryEntry(tokenId).catch((err) => console.error('Failed to delete token', err));
  },

  toggleFavorite: (tokenId) => {
    let nextFavorite = false;
    set((state) => ({
      tokens: state.tokens.map((existing) => {
        if (existing.id !== tokenId) return existing;
        nextFavorite = !existing.isFavorite;
        return { ...existing, isFavorite: nextFavorite };
      }),
    }));
    tokenLibraryApi
      .updateTokenLibraryEntry(tokenId, { is_favorite: nextFavorite })
      .catch((err) => console.error('Failed to persist favorite toggle', err));
  },
}));
