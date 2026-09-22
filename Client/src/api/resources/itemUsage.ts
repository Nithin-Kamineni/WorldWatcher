import { apiDelete, apiGet, apiPost } from '../client';
import type { ApiItemUsage } from '../types';

/** Server-side usefulness signals for the Items window (checklist I-P9).
 *
 * Deliberately NOT paginated: this is one row per item the DM has ever opened in a campaign,
 * and the ranker needs all of them at once to sort anything, so a page boundary would only mean
 * immediately asking for the rest. */
export const listItemUsage = (campaignId: string) =>
  apiGet<ApiItemUsage[]>('/item-usage', { campaign_id: campaignId });

/** Posts what HAPPENED, not the new totals - the server increments, so two Play windows
 * recording the same open cannot clobber each other. */
export const recordItemUsage = (body: { campaign_id: string; kind: string; item_id: string; event: 'use' | 'open'; count?: number }) =>
  apiPost<ApiItemUsage>('/item-usage', body);

export const clearItemUsage = (campaignId: string) =>
  apiDelete(`/item-usage?campaign_id=${encodeURIComponent(campaignId)}`);
