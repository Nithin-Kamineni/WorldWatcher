/** Curated, hand-authored roleplay/exploration random tables (Encounters -> "Roleplay &
 * Exploration" tab) - e.g. a themed "Darkwood Forest" table with linked encounter/behavior/
 * complication columns the DM rolls (or picks) across to build a scene prompt. This is
 * read-only reference content: there's no create/update flow in the app, it's seeded via
 * Database/Maintainance/scripts/seed_situational_tables.py. */

export interface SituationalTableEntry {
  roll: number;
  text: string;
}

export interface SituationalTableColumn {
  key: string;
  label: string;
  /** Die size to roll for this column (6, 8, 10, 12, 20...), or 0 when the table is a
   * lookup keyed by something else (e.g. Challenge Rating) rather than an independent
   * random roll - see the entry text for the actual key in that case. */
  dieSize: number;
  entries: SituationalTableEntry[];
}

export interface SituationalTable {
  id: string;
  name: string;
  theme: string;
  tags: string[];
  description: string;
  source: string;
  columns: SituationalTableColumn[];
}
