/**
 * Effect catalogue shapes for the map/initiative token status picker.
 *
 * "Reference, never duplicate": the 15 core 5e conditions are rows in the
 * server's `conditions` table (exposed at /api/conditions and already used by
 * EncounterFormDialog's trap/hazard editors), so this file no longer restates
 * their names. `useEffectCatalogStore` loads them, keeps each row's rules text
 * for the picker's tooltip, and only falls back to CONDITION_FALLBACK_NAMES
 * when the request fails - so the picker still works offline, but the server
 * is the source of truth whenever it answers.
 */

export type EffectGroup = 'condition' | 'status' | 'spell' | 'disease' | 'custom';

export interface EffectCatalogEntry {
  /** the name stored on PlacedToken.effects */
  name: string;
  group: EffectGroup;
  /** rules text, when the source row carries one */
  description?: string;
}

export const EFFECT_GROUP_LABELS: Record<EffectGroup, string> = {
  condition: 'Conditions',
  status: 'Statuses',
  spell: 'Spells & effects',
  disease: 'Diseases',
  custom: 'Custom',
};

/**
 * `conditions.condition_type` maps straight onto the picker's groups - the table already
 * separates the 15 core conditions from statuses (Bloodied, Concentration, Surprised) and
 * from the source books' diseases, which is exactly how a DM wants them listed.
 */
export const CONDITION_TYPE_TO_GROUP: Record<string, EffectGroup> = {
  condition: 'condition',
  status: 'status',
  disease: 'disease',
};

/**
 * Names only, used when /api/conditions cannot be reached. Kept deliberately
 * short - it is a degraded mode, not a second catalogue to maintain.
 */
export const CONDITION_FALLBACK_NAMES: string[] = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
];

/**
 * Spell-and-status markers a DM parks on a token. Not conditions, and not all of them are
 * spells either (Dying, Stable, Dodge, Rage), so there is no single table to reference - this
 * stays a curated list. Anything the conditions table already carries (Concentration) is
 * dropped by the catalogue's dedupe rather than removed here.
 */
export const SPELL_STATUS_EFFECTS: string[] = [
  'Bless',
  'Bane',
  'Hex',
  "Hunter's Mark",
  'Faerie Fire',
  'Hold Person',
  'Confusion',
  'Haste',
  'Slow',
  'Concentration',
  'Sanctuary',
  'Shield of Faith',
  'Stoneskin',
  'Mirror Image',
  'Blur',
  'Fly',
  'Enlarge',
  'Reduce',
  'Web',
  'Entangle',
  'Silence',
  'Guidance',
  'Bardic Inspiration',
  'Polymorph',
  'Banishment',
  'Dominate Person',
  'Rage',
  'Dodge',
  'Dying',
  'Stable',
];
