export const FACTION_TYPE_PRESETS = [
  'Guild',
  'Cult',
  'Noble House',
  'Criminal Organization',
  'Military Order',
  'Religious Order',
];

export type FactionInfluence = 'petty' | 'local' | 'minor' | 'regional' | 'major';

export interface FactionInfluenceOption {
  value: FactionInfluence;
  label: string;
  /** node diameter (px) in the diplomacy graph's outer/inner rings */
  ringNodeSize: number;
}

export const FACTION_INFLUENCE_OPTIONS: FactionInfluenceOption[] = [
  { value: 'petty', label: 'Petty', ringNodeSize: 0 },
  { value: 'local', label: 'Local', ringNodeSize: 44 },
  { value: 'minor', label: 'Minor', ringNodeSize: 54 },
  { value: 'regional', label: 'Regional', ringNodeSize: 64 },
  { value: 'major', label: 'Major', ringNodeSize: 80 },
];

export function getFactionInfluenceOption(influence: FactionInfluence): FactionInfluenceOption {
  return FACTION_INFLUENCE_OPTIONS.find((o) => o.value === influence) ?? FACTION_INFLUENCE_OPTIONS[3];
}

export interface Faction {
  id: string;
  name: string;
  description: string;
  /** e.g. Guild, Cult, Noble House, Criminal Organization, Military Order, Religious Order */
  factionType: string;
  goals: string[];
  beliefs: string[];
  resources: string[];
  locations: string[];
  members: string[];
  notes: string;
  imageSrc: string;
  /** Diplomacy graph fields - also editable from the table view's faction form, since the
   * table and the graph are backed by the same Faction rows. */
  governance: string;
  /** Numeric magnitude used for sorting/comparison bars in the graph. */
  power: number;
  /** Display text for the Power column/badge, e.g. ">10", "10", "5" - defaults to String(power). */
  powerLabel: string;
  /** Freeform narrative location summary shown on the graph's faction card (distinct from
   * the structured `locations` tag list above). */
  locationSummary: string;
  /** 0-100 comparison stats shown as horizontal bars in the graph's detail panel. */
  military: number;
  naval: number;
  economy: number;
  reputation: number;
  /** Drives node size in the diplomacy graph; 'petty' factions never appear in the graph. */
  influence: FactionInfluence;
  createdAt: number;
  updatedAt: number;
}
