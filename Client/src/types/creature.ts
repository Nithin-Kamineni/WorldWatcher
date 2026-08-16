export type CreatureRelation = 'ally' | 'enemy' | 'neutral' | 'player';

export interface CreatureRelationOption {
  value: CreatureRelation;
  label: string;
  color: 'success' | 'error' | 'default' | 'info';
  /** noticeable map/initiative-bar tint color for this relation, if any (only 'player' has one today) */
  tint?: string;
}

export const CREATURE_RELATION_OPTIONS: CreatureRelationOption[] = [
  { value: 'ally', label: 'Ally', color: 'success' },
  { value: 'enemy', label: 'Enemy', color: 'error' },
  { value: 'neutral', label: 'Neutral', color: 'default' },
  { value: 'player', label: 'Player', color: 'info', tint: '#2196f3' },
];

export function getCreatureRelationOption(relation: CreatureRelation): CreatureRelationOption {
  return CREATURE_RELATION_OPTIONS.find((o) => o.value === relation) ?? CREATURE_RELATION_OPTIONS[2];
}

export type CreatureImportance =
  | 'boss'
  | 'npc'
  | 'side-character'
  | 'recurring'
  | 'important'
  | 'quest-giver'
  | 'minion'
  | 'summon'
  | 'monster';

export interface CreatureImportanceOption {
  value: CreatureImportance;
  label: string;
  color: 'error' | 'warning' | 'info' | 'secondary' | 'success' | 'default';
}

export const CREATURE_IMPORTANCE_OPTIONS: CreatureImportanceOption[] = [
  { value: 'boss', label: 'Boss', color: 'error' },
  { value: 'npc', label: 'NPC', color: 'info' },
  { value: 'side-character', label: 'Side Character', color: 'secondary' },
  { value: 'recurring', label: 'Recurring', color: 'secondary' },
  { value: 'important', label: 'Important', color: 'warning' },
  { value: 'quest-giver', label: 'Quest Giver', color: 'warning' },
  { value: 'minion', label: 'Minion', color: 'default' },
  { value: 'summon', label: 'Summon', color: 'default' },
  { value: 'monster', label: 'Monster', color: 'error' },
];

export function getCreatureImportanceOption(importance: CreatureImportance): CreatureImportanceOption {
  return CREATURE_IMPORTANCE_OPTIONS.find((o) => o.value === importance) ?? CREATURE_IMPORTANCE_OPTIONS[0];
}

export interface CreatureTypeOption {
  value: string;
  label: string;
}

/** monster-only: the 14 standard D&D 5e creature types. Values are lowercase to match the
 * raw `creature_type` string stored on imported/seeded monster stat blocks. */
export const CREATURE_TYPE_OPTIONS: CreatureTypeOption[] = [
  { value: 'aberration', label: 'Aberration' },
  { value: 'beast', label: 'Beast' },
  { value: 'celestial', label: 'Celestial' },
  { value: 'construct', label: 'Construct' },
  { value: 'dragon', label: 'Dragon' },
  { value: 'elemental', label: 'Elemental' },
  { value: 'fey', label: 'Fey' },
  { value: 'fiend', label: 'Fiend' },
  { value: 'giant', label: 'Giant' },
  { value: 'humanoid', label: 'Humanoid' },
  { value: 'monstrosity', label: 'Monstrosity' },
  { value: 'ooze', label: 'Ooze' },
  { value: 'plant', label: 'Plant' },
  { value: 'undead', label: 'Undead' },
];

export interface CreatureAlignmentOption {
  value: string;
  label: string;
}

/** monster-only: the 9 standard alignments. Values match the exact "Lawful Good" / "Neutral"
 * style strings produced by the importer (see ALIGN_MAP in the projector) - true neutral is
 * stored as "Neutral", not "True Neutral". */
export const CREATURE_ALIGNMENT_OPTIONS: CreatureAlignmentOption[] = [
  { value: 'Lawful Good', label: 'Lawful Good' },
  { value: 'Neutral Good', label: 'Neutral Good' },
  { value: 'Chaotic Good', label: 'Chaotic Good' },
  { value: 'Lawful Neutral', label: 'Lawful Neutral' },
  { value: 'Neutral', label: 'True Neutral' },
  { value: 'Chaotic Neutral', label: 'Chaotic Neutral' },
  { value: 'Lawful Evil', label: 'Lawful Evil' },
  { value: 'Neutral Evil', label: 'Neutral Evil' },
  { value: 'Chaotic Evil', label: 'Chaotic Evil' },
];

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export type CreatureCategory = 'monster' | 'npc';

export interface Creature {
  id: string;
  category: CreatureCategory;
  tokenImage: string;
  name: string;
  /** npc-only: relation/importance/profession/roleplay fields don't apply to vanilla monster-manual stat blocks */
  relation: CreatureRelation;
  importance: CreatureImportance;
  profession?: string;
  size: string;
  type: string;
  alignment: string;
  ac: number;
  hp: number;
  hpFormula?: string;
  speed: string;
  abilities: AbilityScores;
  skills?: string;
  senses?: string;
  passivePerception?: number;
  languages?: string;
  cr: string;
  proficiency: number;
  /** special abilities (monsters) or personality traits (NPCs) */
  traits?: string;
  /** npc-only */
  level?: number;
  /** npc-only */
  characterClass?: string;
  /** npc-only */
  motivations?: string;
  /** npc-only */
  pitfalls?: string;
  /** npc-only */
  history?: string;
  /** grid-relative size multiplier (1.0 = one full grid cell); reset target for currentSize */
  defaultSize: number;
  /** grid-relative size multiplier actually used the next time this creature is placed */
  currentSize: number;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}
