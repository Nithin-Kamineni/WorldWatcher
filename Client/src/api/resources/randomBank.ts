import { apiGet } from '../client';
import type { ApiRandomMotivation, ApiRandomName, ApiRandomPitfall, ApiRandomProfession } from '../types';

export const listRandomNames = () => apiGet<ApiRandomName[]>('/random-bank/names');
export const listRandomProfessions = () => apiGet<ApiRandomProfession[]>('/random-bank/professions');
export const listRandomMotivations = () => apiGet<ApiRandomMotivation[]>('/random-bank/motivations');
export const listRandomPitfalls = () => apiGet<ApiRandomPitfall[]>('/random-bank/pitfalls');
