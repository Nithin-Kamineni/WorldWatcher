import { apiDelete, apiGet, apiPatch, apiPost, type Page, type QueryParams } from '../client';
import type { ApiBastion, ApiBastionDetail, ApiBastionFacility, ApiBastionFacilityInstance } from '../types';

export const listBastionFacilities = (params: QueryParams) =>
  apiGet<Page<ApiBastionFacility>>('/bastion-facilities', params);
export const getBastionFacility = (id: string) => apiGet<ApiBastionFacility>(`/bastion-facilities/${id}`);

export const listBastions = (params: QueryParams) => apiGet<Page<ApiBastion>>('/bastions', params);
export const getBastion = (id: string) => apiGet<ApiBastionDetail>(`/bastions/${id}`);
export const createBastion = (body: Record<string, unknown>) => apiPost<ApiBastion>('/bastions', body);
export const updateBastion = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiBastion>(`/bastions/${id}`, body);
export const deleteBastion = (id: string) => apiDelete(`/bastions/${id}`);

export const addBastionFacilityInstance = (bastionId: string, body: Record<string, unknown>) =>
  apiPost<ApiBastionFacilityInstance>(`/bastions/${bastionId}/facilities`, body);
export const updateBastionFacilityInstance = (instanceId: string, body: Record<string, unknown>) =>
  apiPatch<ApiBastionFacilityInstance>(`/bastions/facilities/${instanceId}`, body);
export const removeBastionFacilityInstance = (instanceId: string) =>
  apiDelete(`/bastions/facilities/${instanceId}`);
