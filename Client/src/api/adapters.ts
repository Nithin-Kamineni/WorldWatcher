/** Converts between the backend's snake_case API shapes (src/api/types.ts)
 * and the app's existing camelCase domain types (src/types/*.ts). Keeping
 * every conversion in this one file means every existing component and
 * form dialog keeps working completely unchanged - only the zustand
 * stores' data source changes. */
import { assetFileUrl } from './client';
import { uploadAsset } from './resources/assets';
import type {
  ApiBastion,
  ApiBastionDetail,
  ApiBastionFacility,
  ApiBastionFacilityInstance,
  ApiCampaign,
  ApiCreature,
  ApiCreatureDetail,
  ApiEncounterCreature,
  ApiEncounterDetail,
  ApiEncounterTableCreature,
  ApiFaction,
  ApiFactionRelation,
  ApiItem,
  ApiMapFloor,
  ApiMapShape,
  ApiMapToken,
  ApiQuest,
  ApiRandomEncounterTable,
  ApiSpell,
  ApiTokenLibraryEntry,
} from './types';
import type { Bastion, BastionFacility, BastionFacilityInstance, BastionFacilityInstanceStatus } from '../types/bastion';
import type { Campaign } from '../types/campaign';
import type { AbilityScores, Creature, CreatureCategory } from '../types/creature';
import type {
  Encounter,
  EncounterCreatureEntry,
  EncounterResolutionType,
  EncounterRollTable,
  RandomTableCreature,
  RandomTableRow,
} from '../types/encounter';
import type { Faction } from '../types/faction';
import type { FactionRelation, FactionRelationType } from '../types/factionRelation';
import type { MagicItem, MagicItemRarity } from '../types/magicItem';
import type { MapFloor } from '../types/map';
import type { Quest, QuestObjective, QuestStatus } from '../types/quest';
import type { RandomEncounterTable, RandomEncounterTableEntry } from '../types/randomEncounterTable';
import { DEFAULT_INITIATIVE_STATE } from '../types/initiative';
import type { AoEShape, AoEShapeType } from '../types/shape';
import type { Spell } from '../types/spell';
import type { PlacedToken, TokenDefinition } from '../types/token';

// ---------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toEpochMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? Date.now() : ms;
}

const CR_FRACTIONS: Record<string, number> = { '1/8': 0.125, '1/4': 0.25, '1/2': 0.5 };

export function parseCr(cr: string): number | null {
  const trimmed = cr.trim();
  if (trimmed in CR_FRACTIONS) return CR_FRACTIONS[trimmed];
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function formatCrDisplay(display: string | null, numeric: number | null): string {
  if (display) return display;
  if (numeric === null) return '0';
  const fraction = Object.entries(CR_FRACTIONS).find(([, value]) => value === numeric);
  return fraction ? fraction[0] : String(numeric);
}

export function parseCreatureType(typeStr: string): { creatureType: string | null; creatureSubtype: string | null } {
  const trimmed = typeStr.trim();
  const match = trimmed.match(/^(.+?)\s*\((.+)\)$/);
  if (match) {
    return { creatureType: match[1].trim(), creatureSubtype: match[2].trim() };
  }
  return { creatureType: trimmed || null, creatureSubtype: null };
}

function formatCreatureType(creatureType: string | null, creatureSubtype: string | null): string {
  if (!creatureType) return '';
  return creatureSubtype ? `${creatureType} (${creatureSubtype})` : creatureType;
}

/** 5etools speed objects look like {"walk":30,"fly":60,"flyCond":"(hover)"}.
 * Homebrew rows (seeded from this app) store a plain string instead. */
function formatSpeed(rawData: unknown): string {
  if (!rawData || typeof rawData !== 'object') return '';
  const speed = (rawData as Record<string, unknown>).speed;
  if (typeof speed === 'string') return speed;
  if (!speed || typeof speed !== 'object') return '';
  const order = ['walk', 'fly', 'swim', 'climb', 'burrow'];
  const parts: string[] = [];
  const speedObj = speed as Record<string, unknown>;
  for (const key of order) {
    const value = speedObj[key];
    if (value === undefined) continue;
    const condKey = `${key}Cond`;
    const cond = typeof speedObj[condKey] === 'string' ? ` ${speedObj[condKey] as string}` : '';
    if (typeof value === 'number') {
      parts.push(key === 'walk' ? `${value} ft.${cond}` : `${key} ${value} ft.${cond}`);
    } else if (value && typeof value === 'object') {
      const n = (value as Record<string, unknown>).number;
      const c = (value as Record<string, unknown>).condition;
      if (typeof n === 'number') {
        parts.push(`${key === 'walk' ? '' : `${key} `}${n} ft.${typeof c === 'string' ? ` ${c}` : ''}`);
      }
    }
  }
  return parts.join(', ');
}

/** If srcUrl is already a hosted backend asset URL, extract its id (no
 * re-upload needed). If it's a local blob: preview URL, upload it. */
export async function resolveImageAsset(
  srcUrl: string,
  assetType: string,
): Promise<{ url: string; assetId: string | null }> {
  if (!srcUrl) return { url: '', assetId: null };

  const hostedMatch = srcUrl.match(/\/assets\/([0-9a-fA-F-]{36})\/file/);
  if (hostedMatch) return { url: srcUrl, assetId: hostedMatch[1] };

  if (srcUrl.startsWith('blob:')) {
    const blob = await (await fetch(srcUrl)).blob();
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'bin';
    const file = new File([blob], `upload.${ext}`, { type: blob.type });
    const asset = await uploadAsset(file, assetType);
    return { url: asset.url ?? assetFileUrl(asset.id), assetId: asset.id };
  }

  // Anything else (external http(s) URL, pre-bundled static import) can't be
  // persisted as a real asset row - leave it as a display-only URL.
  return { url: srcUrl, assetId: null };
}

// ---------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------

export function apiCampaignToCampaign(c: ApiCampaign): Campaign {
  return { id: c.id, name: c.name, imageSrc: assetFileUrl(c.image_asset_id) };
}

// ---------------------------------------------------------------------
// Creature
// ---------------------------------------------------------------------

export function apiCreatureToCreature(c: ApiCreature | ApiCreatureDetail): Creature {
  const abilities: AbilityScores = {
    str: c.strength ?? 10,
    dex: c.dexterity ?? 10,
    con: c.constitution ?? 10,
    int: c.intelligence ?? 10,
    wis: c.wisdom ?? 10,
    cha: c.charisma ?? 10,
  };
  const rawData = 'raw_data' in c ? c.raw_data : undefined;
  return {
    id: c.id,
    category: c.category,
    tokenImage: assetFileUrl(c.token_asset_id ?? c.portrait_asset_id),
    name: c.name,
    relation: (c.relation as Creature['relation']) ?? 'neutral',
    importance: (c.importance as Creature['importance']) ?? 'monster',
    profession: c.profession ?? undefined,
    size: c.size ?? '',
    type: formatCreatureType(c.creature_type, c.creature_subtype),
    alignment: c.alignment ?? '',
    ac: c.armor_class ?? 10,
    hp: c.hit_points ?? 1,
    hpFormula: c.hit_dice ?? undefined,
    speed: formatSpeed(rawData) || '30 ft',
    abilities,
    skills: c.skills ?? undefined,
    senses: c.senses ?? undefined,
    passivePerception: c.passive_perception ?? undefined,
    languages: c.languages ?? undefined,
    cr: formatCrDisplay(c.challenge_rating_display, c.challenge_rating),
    proficiency: c.proficiency_bonus ?? 2,
    traits: c.traits ?? undefined,
    level: c.level ?? undefined,
    characterClass: c.character_class ?? undefined,
    motivations: c.motivations ?? undefined,
    pitfalls: c.pitfalls ?? undefined,
    history: c.history ?? undefined,
    defaultSize: c.default_size,
    currentSize: c.current_size,
    isFavorite: c.is_favorite,
    createdAt: toEpochMs(c.created_at),
    updatedAt: toEpochMs(c.updated_at),
  };
}

export async function creatureToApiPayload(
  creature: Creature,
  campaignId: string,
  category: CreatureCategory,
): Promise<Record<string, unknown>> {
  const { creatureType, creatureSubtype } = parseCreatureType(creature.type);
  const { assetId } = await resolveImageAsset(creature.tokenImage, 'creature_token');
  const isNpc = category === 'npc';
  return {
    campaign_id: campaignId,
    category,
    name: creature.name,
    slug: slugify(creature.name) || crypto.randomUUID(),
    creature_type: creatureType,
    creature_subtype: creatureSubtype,
    size: creature.size || null,
    alignment: creature.alignment || null,
    challenge_rating: parseCr(creature.cr),
    challenge_rating_display: creature.cr || null,
    proficiency_bonus: creature.proficiency,
    armor_class: creature.ac,
    hit_points: creature.hp,
    hit_dice: creature.hpFormula ?? null,
    strength: creature.abilities.str,
    dexterity: creature.abilities.dex,
    constitution: creature.abilities.con,
    intelligence: creature.abilities.int,
    wisdom: creature.abilities.wis,
    charisma: creature.abilities.cha,
    skills: creature.skills ?? null,
    senses: creature.senses ?? null,
    passive_perception: creature.passivePerception ?? null,
    languages: creature.languages ?? null,
    traits: creature.traits ?? null,
    relation: isNpc ? creature.relation : null,
    importance: isNpc ? creature.importance : null,
    profession: isNpc ? (creature.profession ?? null) : null,
    level: isNpc ? (creature.level ?? null) : null,
    character_class: isNpc ? (creature.characterClass ?? null) : null,
    motivations: isNpc ? (creature.motivations ?? null) : null,
    pitfalls: isNpc ? (creature.pitfalls ?? null) : null,
    history: isNpc ? (creature.history ?? null) : null,
    token_asset_id: assetId,
    default_size: creature.defaultSize,
    current_size: creature.currentSize,
    is_favorite: creature.isFavorite,
    raw_data: { speed: creature.speed },
  };
}

// ---------------------------------------------------------------------
// Spell
// ---------------------------------------------------------------------

export function apiSpellToSpell(s: ApiSpell): Spell {
  return {
    id: s.id,
    name: s.name,
    level: s.level,
    school: s.school ?? '',
    castingTime: s.casting_time ?? '',
    range: s.range ?? '',
    components: s.components_display ?? '',
    duration: s.duration ?? '',
    classes: s.classes_display ?? undefined,
    description: s.description ?? '',
    imageSrc: assetFileUrl(s.image_asset_id),
    createdAt: toEpochMs(s.created_at),
    updatedAt: toEpochMs(s.updated_at),
  };
}

export async function spellToApiPayload(spell: Spell, campaignId: string): Promise<Record<string, unknown>> {
  const { assetId } = await resolveImageAsset(spell.imageSrc, 'spell_image');
  return {
    campaign_id: campaignId,
    name: spell.name,
    slug: slugify(spell.name) || crypto.randomUUID(),
    level: spell.level,
    school: spell.school || null,
    casting_time: spell.castingTime || null,
    range: spell.range || null,
    duration: spell.duration || null,
    components_display: spell.components || null,
    classes_display: spell.classes ?? null,
    description: spell.description || null,
    image_asset_id: assetId,
  };
}

// ---------------------------------------------------------------------
// Magic item
// ---------------------------------------------------------------------

const VALID_RARITIES: MagicItemRarity[] = ['common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact'];

function normalizeRarity(rarity: string): MagicItemRarity {
  return (VALID_RARITIES as string[]).includes(rarity) ? (rarity as MagicItemRarity) : 'common';
}

export function apiItemToMagicItem(i: ApiItem): MagicItem {
  return {
    id: i.id,
    name: i.name,
    type: i.item_type ?? '',
    rarity: normalizeRarity(i.rarity),
    attunement: i.requires_attunement,
    attunementRequirement: i.attunement_requirement ?? undefined,
    description: i.description ?? '',
    imageSrc: assetFileUrl(i.image_asset_id),
    createdAt: toEpochMs(i.created_at),
    updatedAt: toEpochMs(i.updated_at),
  };
}

export async function magicItemToApiPayload(item: MagicItem, campaignId: string): Promise<Record<string, unknown>> {
  const { assetId } = await resolveImageAsset(item.imageSrc, 'item_image');
  return {
    campaign_id: campaignId,
    name: item.name,
    slug: slugify(item.name) || crypto.randomUUID(),
    item_type: item.type || null,
    rarity: item.rarity,
    requires_attunement: item.attunement,
    attunement_requirement: item.attunementRequirement || null,
    description: item.description || null,
    image_asset_id: assetId,
  };
}

// ---------------------------------------------------------------------
// Token library
// ---------------------------------------------------------------------

export function apiTokenToTokenDefinition(t: ApiTokenLibraryEntry): TokenDefinition {
  return {
    id: t.id,
    name: t.name,
    imageSrc: assetFileUrl(t.image_asset_id),
    isFavorite: t.is_favorite,
    defaultSize: t.default_size,
    currentSize: t.current_size,
  };
}

export async function tokenDefinitionToApiPayload(token: TokenDefinition): Promise<Record<string, unknown>> {
  const { assetId } = await resolveImageAsset(token.imageSrc, 'creature_token');
  return {
    name: token.name,
    image_asset_id: assetId,
    is_favorite: token.isFavorite,
    default_size: token.defaultSize,
    current_size: token.currentSize,
  };
}

// ---------------------------------------------------------------------
// Map floor / tokens / shapes
// ---------------------------------------------------------------------

export function apiMapTokenToPlacedToken(t: ApiMapToken): PlacedToken {
  return {
    id: t.id,
    tokenId: t.token_definition_id ?? t.creature_id ?? t.id,
    name: t.name,
    imageSrc: t.image_asset_id ? assetFileUrl(t.image_asset_id) : '',
    x: t.x,
    y: t.y,
    size: t.size,
    outlineColor: t.outline_color,
    effects: t.effects ?? [],
    encounterEntryId: t.encounter_creature_id ?? undefined,
    creatureId: t.creature_id ?? undefined,
    hp:
      t.current_hp !== null && t.max_hp !== null
        ? { current: t.current_hp, max: t.max_hp }
        : undefined,
    concentrating: t.concentrating,
    deathSaves:
      t.death_save_successes || t.death_save_failures
        ? { successes: t.death_save_successes, failures: t.death_save_failures }
        : undefined,
    notes: t.notes ?? undefined,
  };
}

export async function placedTokenToApiPayload(token: PlacedToken): Promise<Record<string, unknown>> {
  const { assetId } = token.imageSrc ? await resolveImageAsset(token.imageSrc, 'creature_token') : { assetId: null };
  return {
    name: token.name,
    image_asset_id: assetId,
    x: token.x,
    y: token.y,
    size: token.size,
    outline_color: token.outlineColor,
    effects: token.effects,
    encounter_creature_id: token.encounterEntryId ?? null,
    creature_id: token.creatureId ?? null,
    current_hp: token.hp?.current ?? null,
    max_hp: token.hp?.max ?? null,
    concentrating: token.concentrating ?? false,
    death_save_successes: token.deathSaves?.successes ?? 0,
    death_save_failures: token.deathSaves?.failures ?? 0,
    notes: token.notes ?? null,
  };
}

export function apiMapShapeToAoEShape(s: ApiMapShape): AoEShape {
  return {
    id: s.id,
    type: s.shape_type as AoEShapeType,
    x: s.x,
    y: s.y,
    radius: s.radius ?? 0,
    rotation: s.rotation,
    color: s.color,
    width: s.width ?? undefined,
    height: s.height ?? undefined,
    points: s.points ?? undefined,
    strokeWidth: s.stroke_width ?? undefined,
  };
}

export function aoEShapeToApiPayload(shape: AoEShape): Record<string, unknown> {
  return {
    shape_type: shape.type,
    x: shape.x,
    y: shape.y,
    radius: shape.radius,
    rotation: shape.rotation,
    color: shape.color,
    width: shape.width ?? null,
    height: shape.height ?? null,
    points: shape.points ?? null,
    stroke_width: shape.strokeWidth ?? null,
  };
}

/** Initiative state has no dedicated relational table wired up on the
 * frontend side yet (see Server database_scehma.txt section on
 * combats/combatants) - it's persisted as a JSON snapshot on the
 * floor's raw_data column instead, which is enough for it to survive
 * reloads/restarts without the complexity of a full relational sync
 * of every roll/lock/turn-advance. */
function initiativeFromRawData(rawData: unknown): MapFloor['initiative'] {
  if (rawData && typeof rawData === 'object' && 'initiative' in (rawData as Record<string, unknown>)) {
    const stored = (rawData as Record<string, unknown>).initiative;
    if (stored && typeof stored === 'object') {
      return { ...DEFAULT_INITIATIVE_STATE, ...(stored as Partial<MapFloor['initiative']>) };
    }
  }
  return { ...DEFAULT_INITIATIVE_STATE, entries: [] };
}

function resolvedRosterFromRawData(rawData: unknown): EncounterCreatureEntry[] | null {
  if (rawData && typeof rawData === 'object' && 'resolvedEncounterRoster' in (rawData as Record<string, unknown>)) {
    const stored = (rawData as Record<string, unknown>).resolvedEncounterRoster;
    if (Array.isArray(stored)) return stored as EncounterCreatureEntry[];
  }
  return null;
}

export function assembleMapFloor(floor: ApiMapFloor, tokens: ApiMapToken[], shapes: ApiMapShape[]): MapFloor {
  return {
    id: floor.id,
    name: floor.name,
    imageSrc: assetFileUrl(floor.background_asset_id),
    placedTokens: tokens.map(apiMapTokenToPlacedToken),
    shapes: shapes.map(apiMapShapeToAoEShape),
    flippedHorizontal: floor.flipped_horizontal,
    flippedVertical: floor.flipped_vertical,
    rotation: floor.rotation,
    lockedEncounterId: floor.locked_encounter_id,
    resolvedEncounterRoster: resolvedRosterFromRawData(floor.raw_data),
    initiative: initiativeFromRawData(floor.raw_data),
  };
}

// ---------------------------------------------------------------------
// Encounter
// ---------------------------------------------------------------------

function apiEncounterCreatureToEntry(e: ApiEncounterCreature, creatureName: string, imageSrc: string): EncounterCreatureEntry {
  return {
    id: e.id,
    creatureId: e.creature_id,
    name: e.creature_id ? creatureName : (e.custom_name ?? 'Creature'),
    imageSrc,
    quantity: e.quantity,
    size: e.size_override ?? undefined,
  };
}

function apiEncounterTableCreatureToEntry(
  c: ApiEncounterTableCreature,
  creatureLookup: Map<string, { name: string; tokenImage: string }>,
): RandomTableCreature {
  const linked = c.creature_id ? creatureLookup.get(c.creature_id) : undefined;
  return {
    id: c.id,
    creatureId: c.creature_id,
    name: c.creature_name ?? c.creature_name_raw,
    type: c.creature_type,
    imageSrc: linked?.tokenImage ?? '',
    quantityFormula: c.quantity_formula,
  };
}

export function apiEncounterToEncounter(
  e: ApiEncounterDetail,
  creatureLookup: Map<string, { name: string; tokenImage: string }>,
): Encounter {
  return {
    id: e.id,
    name: e.name,
    description: e.description ?? '',
    challengeRating: e.challenge_rating_display ?? '',
    theme: e.theme ?? '',
    encounterType: e.encounter_type ?? undefined,
    possibleLocations: e.possible_locations ?? undefined,
    tags: e.tags,
    resolutionType: (e.resolution_type as EncounterResolutionType) ?? 'fixed',
    sourceId: e.source_id ?? undefined,
    page: e.page ?? undefined,
    tables: (e.tables as EncounterRollTable[] | null) ?? undefined,
    randomTables: (e.random_tables ?? []).map((t): RandomTableRow => ({
      id: t.id,
      diceExpression: t.dice_expression,
      minLevel: t.min_level,
      maxLevel: t.max_level,
      min: t.min,
      max: t.max,
      resultText: t.result_text ?? '',
      creatures: t.creatures.map((c) => apiEncounterTableCreatureToEntry(c, creatureLookup)),
    })),
    creatures: e.creatures.map((entry) => {
      const linked = entry.creature_id ? creatureLookup.get(entry.creature_id) : undefined;
      return apiEncounterCreatureToEntry(
        entry,
        linked?.name ?? entry.custom_name ?? 'Creature',
        linked?.tokenImage ?? '',
      );
    }),
    createdAt: toEpochMs(e.created_at),
    updatedAt: toEpochMs(e.updated_at),
  };
}

export function encounterToApiPayload(encounter: Encounter, campaignId: string): Record<string, unknown> {
  return {
    campaign_id: campaignId,
    name: encounter.name,
    description: encounter.description || null,
    challenge_rating_display: encounter.challengeRating || null,
    theme: encounter.theme || null,
    encounter_type: encounter.encounterType ?? null,
    possible_locations: encounter.possibleLocations ?? null,
    tags: encounter.tags,
    resolution_type: encounter.resolutionType,
    page: encounter.page ?? null,
    tables: encounter.tables ?? null,
  };
}

export function encounterEntryToApiPayload(entry: EncounterCreatureEntry): Record<string, unknown> {
  return {
    creature_id: entry.creatureId,
    custom_name: entry.creatureId ? null : entry.name,
    quantity: entry.quantity,
    size_override: entry.size ?? null,
  };
}

// ---------------------------------------------------------------------
// Faction
// ---------------------------------------------------------------------

/** The JSONB tag-list fields (goals, beliefs, etc.) are stored as plain string arrays,
 * but come back as `unknown` from the API - coerce defensively in case of stale/odd data. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

export function apiFactionToFaction(f: ApiFaction): Faction {
  return {
    id: f.id,
    name: f.name,
    description: f.description ?? '',
    factionType: f.faction_type ?? '',
    goals: toStringArray(f.goals),
    beliefs: toStringArray(f.beliefs),
    resources: toStringArray(f.resources),
    locations: toStringArray(f.locations),
    members: toStringArray(f.members),
    notes: f.notes ?? '',
    imageSrc: assetFileUrl(f.image_asset_id),
    governance: f.governance ?? '',
    power: f.power,
    powerLabel: f.power_label ?? '',
    locationSummary: f.location_summary ?? '',
    military: f.military,
    naval: f.naval,
    economy: f.economy,
    reputation: f.reputation,
    createdAt: toEpochMs(f.created_at),
    updatedAt: toEpochMs(f.updated_at),
  };
}

export function factionToApiPayload(faction: Faction, campaignId: string): Record<string, unknown> {
  return {
    campaign_id: campaignId,
    name: faction.name,
    description: faction.description || null,
    faction_type: faction.factionType || null,
    goals: faction.goals,
    beliefs: faction.beliefs,
    resources: faction.resources,
    locations: faction.locations,
    members: faction.members,
    notes: faction.notes || null,
    governance: faction.governance || null,
    power: faction.power,
    power_label: faction.powerLabel || null,
    location_summary: faction.locationSummary || null,
    military: faction.military,
    naval: faction.naval,
    economy: faction.economy,
    reputation: faction.reputation,
  };
}

// ---------------------------------------------------------------------
// Faction relations
// ---------------------------------------------------------------------

export function apiFactionRelationToFactionRelation(r: ApiFactionRelation): FactionRelation {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    factionAId: r.faction_a_id,
    factionBId: r.faction_b_id,
    type: r.relation_type as FactionRelationType,
    strength: r.strength,
    treaties: toStringArray(r.treaties),
    notes: r.notes ?? '',
  };
}

export function factionRelationToApiPayload(relation: FactionRelation, campaignId: string): Record<string, unknown> {
  return {
    campaign_id: campaignId,
    faction_a_id: relation.factionAId,
    faction_b_id: relation.factionBId,
    relation_type: relation.type,
    strength: relation.strength,
    treaties: relation.treaties,
    notes: relation.notes || null,
  };
}

// ---------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------

function objectivesFromJson(value: unknown): QuestObjective[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      id: typeof o.id === 'string' ? o.id : crypto.randomUUID(),
      text: typeof o.text === 'string' ? o.text : '',
      done: !!o.done,
      children: objectivesFromJson(o.children),
    };
  });
}

/** Quest.raw_data is used as the overflow bucket for fields that don't have their own column
 * (difficulty, freeform location, NPCs involved) - same "extra custom data" convention this
 * codebase already uses raw_data for elsewhere (Bugs.txt #6d: no schema change for this). */
function questRawData(value: unknown): { difficulty: string; location: string; npcs: string[] } {
  const o = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  return {
    difficulty: typeof o.difficulty === 'string' ? o.difficulty : '',
    location: typeof o.location === 'string' ? o.location : '',
    npcs: toStringArray(o.npcs),
  };
}

export function apiQuestToQuest(q: ApiQuest): Quest {
  const raw = questRawData(q.raw_data);
  return {
    id: q.id,
    name: q.name,
    description: q.description ?? '',
    status: (q.status as QuestStatus) ?? 'not_started',
    difficulty: raw.difficulty,
    location: raw.location,
    npcs: raw.npcs,
    relatedFactionIds: toStringArray(q.related_faction_ids),
    objectives: objectivesFromJson(q.objectives),
    rewards: typeof q.rewards === 'string' ? q.rewards : '',
    notes: q.notes ?? '',
    createdAt: toEpochMs(q.created_at),
    updatedAt: toEpochMs(q.updated_at),
  };
}

export function questToApiPayload(quest: Quest, campaignId: string): Record<string, unknown> {
  return {
    campaign_id: campaignId,
    name: quest.name,
    description: quest.description || null,
    status: quest.status,
    related_faction_ids: quest.relatedFactionIds,
    objectives: quest.objectives,
    rewards: quest.rewards || null,
    notes: quest.notes || null,
    raw_data: { difficulty: quest.difficulty, location: quest.location, npcs: quest.npcs },
  };
}

// ---------------------------------------------------------------------
// Random encounter tables
// ---------------------------------------------------------------------

function entriesFromJson(value: unknown): RandomEncounterTableEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      return {
        id: typeof o.id === 'string' ? o.id : crypto.randomUUID(),
        encounterId: typeof o.encounter_id === 'string' ? o.encounter_id : '',
      };
    })
    .filter((e) => e.encounterId);
}

export function apiRandomEncounterTableToRandomEncounterTable(t: ApiRandomEncounterTable): RandomEncounterTable {
  return {
    id: t.id,
    campaignId: t.campaign_id,
    name: t.name,
    dieExpression: t.die_expression,
    entries: entriesFromJson(t.entries),
    createdAt: toEpochMs(t.created_at),
    updatedAt: toEpochMs(t.updated_at),
  };
}

export function randomEncounterTableToApiPayload(table: RandomEncounterTable, campaignId: string): Record<string, unknown> {
  return {
    campaign_id: campaignId,
    name: table.name,
    die_expression: table.dieExpression,
    entries: table.entries.map((e) => ({ id: e.id, encounter_id: e.encounterId })),
  };
}

// ---------------------------------------------------------------------
// Bastions
// ---------------------------------------------------------------------

export function apiBastionFacilityToBastionFacility(f: ApiBastionFacility): BastionFacility {
  return {
    id: f.id,
    name: f.name,
    facilityType: f.facility_type,
    space: toStringArray(f.space),
    prerequisiteLevel: f.prerequisite_level,
    orders: toStringArray(f.orders),
    description: f.description ?? '',
    imageSrc: assetFileUrl(f.image_asset_id),
    page: f.page,
  };
}

function apiBastionFacilityInstanceToInstance(f: ApiBastionFacilityInstance): BastionFacilityInstance {
  return {
    id: f.id,
    facilityId: f.facility_id,
    customName: f.custom_name ?? '',
    status: (f.status as BastionFacilityInstanceStatus) ?? 'built',
    defendersAssigned: f.defenders_assigned,
    notes: f.notes ?? '',
    sortOrder: f.sort_order,
  };
}

export function apiBastionToBastion(b: ApiBastion | ApiBastionDetail): Bastion {
  const facilities = 'facilities' in b ? b.facilities.map(apiBastionFacilityInstanceToInstance) : [];
  const raw = (b.raw_data && typeof b.raw_data === 'object' ? b.raw_data : {}) as Record<string, unknown>;
  return {
    id: b.id,
    characterId: b.character_id,
    ownerName: typeof raw.ownerName === 'string' ? raw.ownerName : '',
    name: b.name,
    notes: b.notes ?? '',
    treasury: b.treasury,
    facilities,
    createdAt: toEpochMs(b.created_at),
    updatedAt: toEpochMs(b.updated_at),
  };
}

export function bastionToApiPayload(bastion: Bastion, campaignId: string): Record<string, unknown> {
  return {
    campaign_id: campaignId,
    character_id: bastion.characterId,
    name: bastion.name,
    notes: bastion.notes || null,
    treasury: bastion.treasury,
    raw_data: { ownerName: bastion.ownerName },
  };
}

export function bastionFacilityInstanceToApiPayload(instance: BastionFacilityInstance): Record<string, unknown> {
  return {
    facility_id: instance.facilityId,
    custom_name: instance.customName || null,
    status: instance.status,
    defenders_assigned: instance.defendersAssigned,
    notes: instance.notes || null,
    sort_order: instance.sortOrder,
  };
}
