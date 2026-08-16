export const FACTION_TYPE_PRESETS = [
  'Guild',
  'Cult',
  'Noble House',
  'Criminal Organization',
  'Military Order',
  'Religious Order',
];

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
  createdAt: number;
  updatedAt: number;
}
