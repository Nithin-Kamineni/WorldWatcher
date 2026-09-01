import { apiDelete, apiGet, apiPatch, apiPost, type Page } from '../client';
import type { ApiCampaign } from '../types';

export const listCampaigns = (params?: { world_id?: string }) =>
  apiGet<Page<ApiCampaign>>('/campaigns', { limit: 100, ...params });
export const getCampaign = (id: string) => apiGet<ApiCampaign>(`/campaigns/${id}`);
export const createCampaign = (body: Partial<ApiCampaign>) => apiPost<ApiCampaign>('/campaigns', body);
export const updateCampaign = (id: string, body: Partial<ApiCampaign>) =>
  apiPatch<ApiCampaign>(`/campaigns/${id}`, body);
export const deleteCampaign = (id: string) => apiDelete(`/campaigns/${id}`);
