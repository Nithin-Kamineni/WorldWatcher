import { apiGet } from '../client';
import type { ApiSituationalTable } from '../types';

export const listSituationalTables = (params?: { theme?: string; tag?: string }) =>
  apiGet<ApiSituationalTable[]>('/situational-tables', params);

export const getSituationalTable = (id: string) => apiGet<ApiSituationalTable>(`/situational-tables/${id}`);
