import { create } from 'zustand';
import type { Quest } from '../types/quest';
import { apiQuestToQuest, questToApiPayload } from '../api/adapters';
import * as questsApi from '../api/resources/quests';

interface QuestStoreState {
  questsByCampaignId: Record<string, Quest[]>;
  loadedByCampaignId: Record<string, boolean>;
  fetchQuestsForCampaign: (campaignId: string) => Promise<void>;
  addQuestToCampaign: (campaignId: string, quest: Quest) => void;
  updateQuestInCampaign: (campaignId: string, quest: Quest) => void;
  deleteQuestFromCampaign: (campaignId: string, questId: string) => void;
}

export const useQuestStore = create<QuestStoreState>((set, get) => ({
  questsByCampaignId: {},
  loadedByCampaignId: {},

  fetchQuestsForCampaign: async (campaignId) => {
    if (get().loadedByCampaignId[campaignId]) return;
    try {
      const page = await questsApi.listQuests({ campaign_id: campaignId, limit: 200 });
      set((state) => ({
        questsByCampaignId: { ...state.questsByCampaignId, [campaignId]: page.items.map(apiQuestToQuest) },
        loadedByCampaignId: { ...state.loadedByCampaignId, [campaignId]: true },
      }));
    } catch (err) {
      console.error(`Failed to load quests for campaign ${campaignId}`, err);
    }
  },

  addQuestToCampaign: (campaignId, quest) => {
    set((state) => ({
      questsByCampaignId: {
        ...state.questsByCampaignId,
        [campaignId]: [...(state.questsByCampaignId[campaignId] ?? []), quest],
      },
    }));
    questsApi
      .createQuest({ id: quest.id, ...questToApiPayload(quest, campaignId) })
      .catch((err) => console.error('Failed to persist new quest', err));
  },

  updateQuestInCampaign: (campaignId, quest) => {
    set((state) => ({
      questsByCampaignId: {
        ...state.questsByCampaignId,
        [campaignId]: (state.questsByCampaignId[campaignId] ?? []).map((existing) =>
          existing.id === quest.id ? quest : existing,
        ),
      },
    }));
    questsApi
      .updateQuest(quest.id, questToApiPayload(quest, campaignId))
      .catch((err) => console.error('Failed to persist quest update', err));
  },

  deleteQuestFromCampaign: (campaignId, questId) => {
    set((state) => ({
      questsByCampaignId: {
        ...state.questsByCampaignId,
        [campaignId]: (state.questsByCampaignId[campaignId] ?? []).filter((existing) => existing.id !== questId),
      },
    }));
    questsApi.deleteQuest(questId).catch((err) => console.error('Failed to delete quest', err));
  },
}));

export function getQuestsForCampaign(
  questsByCampaignId: Record<string, Quest[]>,
  campaignId: string | undefined,
): Quest[] {
  if (!campaignId) return [];
  return questsByCampaignId[campaignId] ?? [];
}
