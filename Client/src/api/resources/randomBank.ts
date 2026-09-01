import { apiGet } from '../client';
import type {
  ApiRandomAppearance,
  ApiRandomDungeonQuirk,
  ApiRandomDungeonStateOfRuin,
  ApiRandomMotivation,
  ApiRandomName,
  ApiRandomPersonality,
  ApiRandomPitfall,
  ApiRandomProfession,
  ApiRandomRelationship,
  ApiRandomSecret,
  ApiRandomSettlementCalamity,
  ApiRandomSettlementClaimToFame,
  ApiRandomSettlementDefiningTrait,
  ApiRandomSettlementEconomicSource,
  ApiRandomSettlementLocalLeader,
  ApiRandomSettlementRumorHook,
  ApiRandomShopType,
  ApiRandomTavernNamePart,
} from '../types';

export const listRandomNames = () => apiGet<ApiRandomName[]>('/random-bank/names');
export const listRandomProfessions = () => apiGet<ApiRandomProfession[]>('/random-bank/professions');
export const listRandomMotivations = () => apiGet<ApiRandomMotivation[]>('/random-bank/motivations');
export const listRandomPitfalls = () => apiGet<ApiRandomPitfall[]>('/random-bank/pitfalls');
export const listRandomAppearances = () => apiGet<ApiRandomAppearance[]>('/random-bank/appearances');
export const listRandomSecrets = () => apiGet<ApiRandomSecret[]>('/random-bank/secrets');
export const listRandomPersonalities = () => apiGet<ApiRandomPersonality[]>('/random-bank/personalities');
export const listRandomRelationships = () => apiGet<ApiRandomRelationship[]>('/random-bank/relationships');

export const listRandomDungeonStatesOfRuin = () =>
  apiGet<ApiRandomDungeonStateOfRuin[]>('/random-bank/dungeon-states-of-ruin');
export const listRandomDungeonQuirks = () => apiGet<ApiRandomDungeonQuirk[]>('/random-bank/dungeon-quirks');
export const listRandomShopTypes = () => apiGet<ApiRandomShopType[]>('/random-bank/shop-types');
export const listRandomTavernNameParts = () => apiGet<ApiRandomTavernNamePart[]>('/random-bank/tavern-name-parts');
export const listRandomSettlementDefiningTraits = () =>
  apiGet<ApiRandomSettlementDefiningTrait[]>('/random-bank/settlement-defining-traits');
export const listRandomSettlementClaimsToFame = () =>
  apiGet<ApiRandomSettlementClaimToFame[]>('/random-bank/settlement-claims-to-fame');
export const listRandomSettlementCalamities = () =>
  apiGet<ApiRandomSettlementCalamity[]>('/random-bank/settlement-calamities');
export const listRandomSettlementLocalLeaders = () =>
  apiGet<ApiRandomSettlementLocalLeader[]>('/random-bank/settlement-local-leaders');
export const listRandomSettlementEconomicSources = () =>
  apiGet<ApiRandomSettlementEconomicSource[]>('/random-bank/settlement-economic-sources');
export const listRandomSettlementRumorsHooks = () =>
  apiGet<ApiRandomSettlementRumorHook[]>('/random-bank/settlement-rumors-hooks');
