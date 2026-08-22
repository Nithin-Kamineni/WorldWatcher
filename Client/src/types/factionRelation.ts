/** The Factions diplomacy graph's relation model - one row per unordered faction pair,
 * backed by the `faction_relations` table (see FactionRelation in useFactionStore.ts).
 * Editing a relation from either faction's side edits the same row, so A->B and B->A are
 * always the same data. */

export type FactionRelationType = 'ally' | 'trade' | 'peace' | 'neutral' | 'war' | 'enemy';

export const RELATION_TYPE_META: Record<FactionRelationType, { label: string; color: string }> = {
  ally: { label: 'Allied', color: '#4caf7d' },
  trade: { label: 'Trade Partner', color: '#5fa8e0' },
  peace: { label: 'Peace', color: '#9c8fc9' },
  neutral: { label: 'Neutral', color: '#8a8a99' },
  war: { label: 'War', color: '#d0693f' },
  enemy: { label: 'Sworn Enemy', color: '#c0392b' },
};

export const RELATION_TYPES: FactionRelationType[] = ['ally', 'trade', 'peace', 'neutral', 'war', 'enemy'];

export type FactionRelationImportance = 'primary' | 'secondary';

export const RELATION_IMPORTANCE_OPTIONS: { value: FactionRelationImportance; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
];

export interface FactionRelation {
  id: string;
  campaignId: string;
  factionAId: string;
  factionBId: string;
  type: FactionRelationType;
  /** 0-100, varies connector line thickness/visual weight within its importance tier. */
  strength: number;
  /** Primary = inner ring (closer to center) + thick edge; secondary = outer ring + thin edge. */
  importance: FactionRelationImportance;
  treaties: string[];
  notes: string;
}

export function findRelation(
  relations: FactionRelation[],
  factionAId: string,
  factionBId: string,
): FactionRelation | undefined {
  return relations.find(
    (r) =>
      (r.factionAId === factionAId && r.factionBId === factionBId) ||
      (r.factionAId === factionBId && r.factionBId === factionAId),
  );
}
