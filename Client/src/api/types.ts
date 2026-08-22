/** TypeScript mirrors of the FastAPI backend's Pydantic Read schemas
 * (Server/app/schemas/*.py). Field names are snake_case to match the
 * JSON the API actually returns - src/api/adapters.ts converts these
 * into the app's own camelCase domain types (src/types/*.ts). */

export interface ApiSource {
  id: string;
  name: string;
  abbreviation: string;
  edition: string | null;
  source_type: string;
  publisher: string | null;
  publication_date: string | null;
  page: number | null;
  license: string | null;
  description: string | null;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface ApiAsset {
  id: string;
  filename: string;
  storage_path: string;
  asset_type: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  sha256: string;
  source: string | null;
  source_path: string | null;
  raw_data: unknown;
  created_at: string;
  url: string | null;
}

export interface ApiRandomName {
  id: string;
  name: string;
  name_type: 'first' | 'last';
}

export interface ApiRandomProfession {
  id: string;
  name: string;
}

export interface ApiRandomMotivation {
  id: string;
  text: string;
}

export interface ApiRandomPitfall {
  id: string;
  text: string;
}

export interface ApiCondition {
  id: string;
  source_id: string | null;
  name: string;
  condition_type: string | null;
  description: string | null;
  raw_data: unknown;
}

export interface ApiEffect {
  id: string;
  campaign_id: string | null;
  name: string;
  effect_type: string;
  condition_id: string | null;
  description: string | null;
  icon: string | null;
  mechanics: unknown;
  raw_data: unknown;
}

export interface ApiCreatureAction {
  id: string;
  creature_id: string;
  name: string;
  action_type: string;
  sort_order: number;
  description: string | null;
  attack_bonus: number | null;
  reach: number | null;
  range_normal: number | null;
  range_long: number | null;
  damage_formula: string | null;
  damage_type: string | null;
  save_ability: string | null;
  save_dc: number | null;
  recharge: string | null;
  uses_text: string | null;
  area: unknown;
  mechanics: unknown;
  raw_data: unknown;
}

export interface ApiCreature {
  id: string;
  source_id: string | null;
  campaign_id: string | null;
  category: 'monster' | 'npc';
  name: string;
  slug: string;
  edition: string | null;
  creature_type: string | null;
  creature_subtype: string | null;
  size: string | null;
  alignment: string | null;
  challenge_rating: number | null;
  challenge_rating_display: string | null;
  proficiency_bonus: number | null;
  armor_class: number | null;
  hit_points: number | null;
  hit_dice: string | null;
  strength: number | null;
  dexterity: number | null;
  constitution: number | null;
  intelligence: number | null;
  wisdom: number | null;
  charisma: number | null;
  skills: string | null;
  senses: string | null;
  passive_perception: number | null;
  languages: string | null;
  traits: string | null;
  description: string | null;
  relation: string | null;
  importance: string | null;
  profession: string | null;
  level: number | null;
  character_class: string | null;
  motivations: string | null;
  pitfalls: string | null;
  history: string | null;
  portrait_asset_id: string | null;
  token_asset_id: string | null;
  base_creature_id: string | null;
  is_custom_build: boolean;
  default_size: number;
  current_size: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiCreatureDetail extends ApiCreature {
  raw_data: unknown;
  actions: ApiCreatureAction[];
}

export interface ApiSpell {
  id: string;
  source_id: string | null;
  campaign_id: string | null;
  name: string;
  slug: string;
  edition: string | null;
  level: number;
  school: string | null;
  casting_time: string | null;
  range: string | null;
  duration: string | null;
  concentration: boolean;
  ritual: boolean;
  components_display: string | null;
  components: unknown;
  classes_display: string | null;
  classes: unknown;
  description: string | null;
  area: unknown;
  damage: unknown;
  saving_throw: unknown;
  effects: unknown;
  mechanics: unknown;
  image_asset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiItem {
  id: string;
  source_id: string | null;
  campaign_id: string | null;
  name: string;
  slug: string;
  edition: string | null;
  item_type: string | null;
  rarity: string;
  requires_attunement: boolean;
  attunement_requirement: string | null;
  weight: number | null;
  cost: unknown;
  description: string | null;
  properties: unknown;
  effects: unknown;
  charges: unknown;
  image_asset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiCampaign {
  id: string;
  name: string;
  description: string | null;
  image_asset_id: string | null;
  ruleset: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiCharacter {
  id: string;
  campaign_id: string;
  name: string;
  character_type: string;
  level: number | null;
  class_: string | null;
  subclass: string | null;
  species: string | null;
  background: string | null;
  current_hp: number | null;
  max_hp: number | null;
  temporary_hp: number;
  armor_class: number | null;
  strength: number | null;
  dexterity: number | null;
  constitution: number | null;
  intelligence: number | null;
  wisdom: number | null;
  charisma: number | null;
  skills: unknown;
  saving_throws: unknown;
  resources: unknown;
  equipment: unknown;
  features: unknown;
  notes: string | null;
  portrait_asset_id: string | null;
  token_asset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiLocation {
  id: string;
  campaign_id: string;
  parent_location_id: string | null;
  name: string;
  location_type: string | null;
  description: string | null;
  notes: string | null;
  map_id: string | null;
  image_asset_id: string | null;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface ApiFaction {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  faction_type: string | null;
  goals: unknown;
  beliefs: unknown;
  resources: unknown;
  locations: unknown;
  members: unknown;
  notes: string | null;
  image_asset_id: string | null;
  governance: string | null;
  power: number;
  power_label: string | null;
  location_summary: string | null;
  military: number;
  naval: number;
  economy: number;
  reputation: number;
  influence: string;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export type ApiFactionRelationType = 'ally' | 'trade' | 'peace' | 'neutral' | 'war' | 'enemy';

export interface ApiFactionRelation {
  id: string;
  campaign_id: string;
  faction_a_id: string;
  faction_b_id: string;
  relation_type: ApiFactionRelationType;
  strength: number;
  importance: string;
  treaties: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiRandomEncounterTable {
  id: string;
  campaign_id: string;
  name: string;
  die_expression: string;
  entries: unknown;
  created_at: string;
  updated_at: string;
}

export interface ApiQuest {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  status: string;
  quest_giver_character_id: string | null;
  quest_giver_creature_id: string | null;
  related_faction_ids: unknown;
  related_location_ids: unknown;
  objectives: unknown;
  rewards: unknown;
  notes: string | null;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface ApiBastionFacility {
  id: string;
  source_id: string | null;
  name: string;
  slug: string;
  facility_type: string;
  space: unknown;
  prerequisite_level: number | null;
  hirelings: unknown;
  orders: unknown;
  description: string | null;
  image_asset_id: string | null;
  page: number | null;
  created_at: string;
  updated_at: string;
}

export interface ApiBastionFacilityInstance {
  id: string;
  bastion_id: string;
  facility_id: string | null;
  custom_name: string | null;
  status: string;
  defenders_assigned: number;
  pending_order: unknown;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ApiBastion {
  id: string;
  campaign_id: string;
  character_id: string | null;
  name: string;
  notes: string | null;
  treasury: number;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface ApiBastionDetail extends ApiBastion {
  facilities: ApiBastionFacilityInstance[];
}

export interface ApiMap {
  id: string;
  campaign_id: string;
  location_id: string | null;
  name: string;
  description: string | null;
  map_kinds: string[];
  map_location_text: string | null;
  setting: string | null;
  activity: string | null;
  grid_enabled: boolean;
  grid_size: number;
  grid_color: string;
  grid_thickness: number;
  grid_type: string;
  primary_floor_id: string | null;
  settings: unknown;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface ApiMapFloor {
  id: string;
  map_id: string;
  name: string;
  sort_order: number;
  background_asset_id: string;
  width: number | null;
  height: number | null;
  flipped_horizontal: boolean;
  flipped_vertical: boolean;
  rotation: number;
  locked_encounter_id: string | null;
  walls: unknown;
  doors: unknown;
  lighting: unknown;
  terrain: unknown;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface ApiTokenLibraryEntry {
  id: string;
  campaign_id: string | null;
  name: string;
  image_asset_id: string;
  is_favorite: boolean;
  default_size: number;
  current_size: number;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface ApiMapToken {
  id: string;
  map_floor_id: string;
  token_definition_id: string | null;
  creature_id: string | null;
  character_id: string | null;
  encounter_creature_id: string | null;
  name: string;
  image_asset_id: string | null;
  x: number;
  y: number;
  size: number;
  outline_color: string;
  current_hp: number | null;
  max_hp: number | null;
  concentrating: boolean;
  death_save_successes: number;
  death_save_failures: number;
  effects: string[];
  notes: string | null;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface ApiMapShape {
  id: string;
  map_floor_id: string;
  shape_type: string;
  x: number;
  y: number;
  radius: number | null;
  rotation: number;
  width: number | null;
  height: number | null;
  points: number[] | null;
  color: string;
  stroke_width: number | null;
  raw_data: unknown;
  created_at: string;
}

export interface ApiEncounterCreature {
  id: string;
  encounter_id: string;
  creature_id: string | null;
  custom_name: string | null;
  custom_image_asset_id: string | null;
  quantity: number;
  size_override: number | null;
  sort_order: number;
  raw_data: unknown;
}

export interface ApiEncounter {
  id: string;
  campaign_id: string | null;
  map_id: string | null;
  source_id: string | null;
  page: number | null;
  resolution_type: string;
  tables: unknown;
  name: string;
  description: string | null;
  challenge_rating_display: string | null;
  computed_adjusted_xp: number | null;
  computed_cr: string | null;
  difficulty: string | null;
  theme: string | null;
  encounter_type: string | null;
  possible_locations: string[] | null;
  environment: string | null;
  tags: string[];
  starting_positions: unknown;
  special_rules: unknown;
  notes: string | null;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface ApiEncounterTableCreature {
  id: string;
  encounter_table_id: string;
  creature_id: string | null;
  creature_name_raw: string;
  quantity_formula: string;
  sort_order: number;
  /** joined from creatures at read time - null when creature_id didn't resolve */
  creature_name: string | null;
  creature_type: string | null;
}

export interface ApiEncounterTable {
  id: string;
  encounter_id: string;
  dice_expression: string | null;
  min_level: number | null;
  max_level: number | null;
  min: number;
  max: number;
  result_text: string | null;
  sort_order: number;
  creatures: ApiEncounterTableCreature[];
}

export interface ApiEncounterDetail extends ApiEncounter {
  creatures: ApiEncounterCreature[];
  random_tables: ApiEncounterTable[];
}

export interface ApiCombatant {
  id: string;
  combat_id: string;
  map_token_id: string | null;
  creature_id: string | null;
  character_id: string | null;
  display_name: string;
  current_hp: number | null;
  temporary_hp: number;
  max_hp: number | null;
  initiative_base_roll: number | null;
  initiative_modifier: number;
  initiative: number | null;
  initiative_order: number | null;
  initiative_locked: boolean;
  is_current_turn: boolean;
  x: number | null;
  y: number | null;
  z: number | null;
  movement_used: number;
  conditions: unknown[];
  effects: unknown[];
  resources: unknown;
  concentration: unknown;
  death_save_successes: number;
  death_save_failures: number;
  action_used: boolean;
  bonus_action_used: boolean;
  reaction_used: boolean;
  visibility: unknown;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ApiCombat {
  id: string;
  encounter_id: string | null;
  campaign_id: string;
  map_floor_id: string | null;
  name: string | null;
  round: number;
  current_turn: number | null;
  status: 'idle' | 'rolling' | 'active' | 'completed';
  events: unknown;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiCombatDetail extends ApiCombat {
  combatants: ApiCombatant[];
}
