/** Bugs.txt: "several encounters" grouped into a table the DM rolls a die against to pick
 * one. Backed by the `random_encounter_tables` table (see useRandomEncounterTableStore.ts) -
 * distinct from an individual Encounter's own `tables`/`resolutionType` fields, which are
 * importer-owned reference data for 5etools' own random-encounter tables. */
export interface RandomEncounterTableEntry {
  id: string;
  encounterId: string;
}

export interface RandomEncounterTable {
  id: string;
  campaignId: string;
  name: string;
  /** e.g. "1d8", "1d20" - sized to fit `entries.length` by the form dialog, but editable */
  dieExpression: string;
  entries: RandomEncounterTableEntry[];
  createdAt: number;
  updatedAt: number;
}
