export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  classes?: string;
  description: string;
  imageSrc: string;
  createdAt: number;
  updatedAt: number;
}

export function formatSpellLevel(level: number): string {
  return level === 0 ? 'Cantrip' : `Level ${level}`;
}

/** Static list (not derived from loaded spells) so the school filter works even though the
 * full spell library is now paginated server-side instead of held in memory. */
export const SPELL_SCHOOL_OPTIONS = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation',
];

/** Bugs.txt #2g - school tag colors, chosen by the user. */
export const SPELL_SCHOOL_COLORS: Record<string, string> = {
  Abjuration: '#6CC2D1',
  Enchantment: '#B14583',
  Conjuration: '#563369',
  Illusion: '#393F7D',
  Transmutation: '#7BBF5C',
  Divination: '#D5CC41',
  Necromancy: '#7B4636',
  Evocation: '#357C54',
};

/** Picks readable text (black or white) against a given school color's background. */
export function schoolTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1a1a1a' : '#ffffff';
}

export const SPELL_CLASS_OPTIONS = [
  'Artificer',
  'Barbarian',
  'Bard',
  'Cleric',
  'Druid',
  'Fighter',
  'Monk',
  'Paladin',
  'Ranger',
  'Rogue',
  'Sorcerer',
  'Warlock',
  'Wizard',
];

/** Bugs.txt #2e - "1 reaction, which you take when..." -> "1 reaction" for the table; the
 * full text still shows in SpellDetailDialog. */
export function formatCastingTimeShort(castingTime: string): string {
  if (!castingTime) return castingTime;
  return castingTime.split(',')[0].trim();
}

/** Bugs.txt #2f - "Self (60 feet cone)" -> "Self" for the table; full text in the detail view. */
export function formatRangeShort(range: string): string {
  if (!range) return range;
  return /^self\s*\(/i.test(range.trim()) ? 'Self' : range;
}

/** "V, S, M (a bit of sponge)" -> "V, S, M" for the table; full text (with material
 * description) still shows in the detail view. */
export function formatComponentsShort(components: string): string {
  if (!components) return components;
  return components.replace(/\s*\([^)]*\)\s*/g, '').trim();
}
