import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import type { ApiMapShape, ApiMapToken } from '../types';

export const listMapTokens = (floorId: string) => apiGet<ApiMapToken[]>(`/map-floors/${floorId}/tokens`);
export const createMapToken = (floorId: string, body: Record<string, unknown>) =>
  apiPost<ApiMapToken>(`/map-floors/${floorId}/tokens`, body);
export const updateMapToken = (tokenId: string, body: Record<string, unknown>) =>
  apiPatch<ApiMapToken>(`/map-tokens/${tokenId}`, body);
export const deleteMapToken = (tokenId: string) => apiDelete(`/map-tokens/${tokenId}`);

export const listMapShapes = (floorId: string) => apiGet<ApiMapShape[]>(`/map-floors/${floorId}/shapes`);
export const createMapShape = (floorId: string, body: Record<string, unknown>) =>
  apiPost<ApiMapShape>(`/map-floors/${floorId}/shapes`, body);
export const deleteMapShape = (shapeId: string) => apiDelete(`/map-shapes/${shapeId}`);
