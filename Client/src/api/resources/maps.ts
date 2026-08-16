import { apiDelete, apiGet, apiPatch, apiPost, type Page, type QueryParams } from '../client';
import type { ApiMap, ApiMapFloor } from '../types';

export const listMaps = (params: QueryParams) => apiGet<Page<ApiMap>>('/maps', params);
export const getMap = (id: string) => apiGet<ApiMap>(`/maps/${id}`);
export const createMap = (body: Record<string, unknown>) => apiPost<ApiMap>('/maps', body);
export const updateMap = (id: string, body: Record<string, unknown>) => apiPatch<ApiMap>(`/maps/${id}`, body);
export const deleteMap = (id: string) => apiDelete(`/maps/${id}`);

export const listMapFloors = (mapId: string) => apiGet<ApiMapFloor[]>(`/maps/${mapId}/floors`);
export const createMapFloor = (mapId: string, body: Record<string, unknown>) =>
  apiPost<ApiMapFloor>(`/maps/${mapId}/floors`, body);
export const updateMapFloor = (floorId: string, body: Record<string, unknown>) =>
  apiPatch<ApiMapFloor>(`/map-floors/${floorId}`, body);
export const deleteMapFloor = (floorId: string) => apiDelete(`/map-floors/${floorId}`);
