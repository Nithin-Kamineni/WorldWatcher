import { apiGet, type Page, type QueryParams } from '../client';
import type { ApiCondition } from '../types';

export const listConditions = (params: QueryParams = {}) => apiGet<Page<ApiCondition>>('/conditions', params);
