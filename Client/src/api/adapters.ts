/** Converts between the backend's snake_case API shapes (src/api/types.ts)
 * and the app's existing camelCase domain types (src/types/*.ts). Keeping
 * every conversion in this one file means every existing component and
 * form dialog keeps working completely unchanged - only the zustand
 * stores' data source changes. */
import { assetFileUrl } from './client';
import { uploadAsset } from './resources/assets';
import type {
  ApiArticle,
  ApiArticleFolder,
  ApiBastion,
  ApiBastionDetail,
  ApiBastionFacility,
  ApiBastionFacilityInstance,
  ApiCampaign,
  ApiCategory,
  ApiCategoryNode,
  ApiCreature,
  ApiCreatureDetail,
  ApiEncounterCombatBlock,
  ApiEncounterCreature,
  ApiEncounterDetail,
  ApiEncounterExplorationBlock,
  ApiEncounterNpc,
  ApiEncounterSocialBlock,
  ApiEncounterTableCreature,
  ApiEntityRevision,
  ApiRestoreResult,
  ApiRetentionPolicy,
  ApiRevisionChange,
  ApiFaction,
  ApiFactionRelation,
  ApiGenerator,
  ApiGeneratorComponent,
  ApiGeneratorDetail,
  ApiGeneratorRollResult,
  ApiGeneratorRollSlotResult,
  ApiItem,
  ApiMapFloor,
  ApiMapShape,
  ApiMapToken,
  ApiNote,
  ApiNoteFolder,
  ApiQuest,
  ApiRandomTable,
  ApiRandomTableDetail,
  ApiRolledDie,
  ApiRollResult,
  ApiRollResultItem,
  ApiSessionChat,
  ApiSpell,
  ApiTableColumn,
  ApiTableEntry,
  ApiTableFormat,
  ApiTag,
  ApiTokenLibraryEntry,
  ApiWorld,
} from './types';
import type { Article, ArticleCategory, ArticleFolder, ArticleVisibility } from '../types/article';
import type { Note, NoteFolder, NoteKind } from '../types/note';
import { NOTE_DOC_TYPES, asCanvas, type NoteDocType } from '../types/noteCanvas';
import type { SessionChat } from '../types/sessionChat';
import type { Bastion, BastionFacility, BastionFacilityInstance, BastionFacilityInstanceStatus } from '../types/bastion';
import type { Campaign } from '../types/campaign';
import type { World } from '../types/world';
import type { AbilityScores, Creature, CreatureCategory } from '../types/creature';
import type {
  CombatRole,
  Encounter,
  EncounterCombatBlock,
  EncounterCreatureEntry,
  EncounterExplorationBlock,
  EncounterNpcEntry,
  EncounterPrimaryType,
  EncounterResolutionType,
  EncounterRollTable,
  EncounterSocialBlock,
  EncounterStatus,
  NpcAgenda,
  NpcAttitude,
  RandomTableCreature,
  RandomTableRow,
  RpCues,
} from '../types/encounter';
import type { Faction, FactionInfluence } from '../types/faction';
import type { FactionRelation, FactionRelationImportance, FactionRelationType } from '../types/factionRelation';
import type { MagicItem, MagicItemRarity } from '../types/magicItem';
import type { MapFloor } from '../types/map';
import type { FogState, WallSegment } from '../types/fog';
import { DEFAULT_FOG_STATE } from '../types/fog';
import type { Quest, QuestObjective, QuestStatus } from '../types/quest';
import type {
  EntityRevision,
  RevisionChange,
  RevisionRestoreResult,
  RevisionRetentionPolicy,
} from '../types/revision';
import type { Category, CategoryNode } from '../types/category';
import type { Tag } from '../types/tag';
import type { TableFormat } from '../types/tableFormat';
import type {
  RandomTable,
  RandomTableDetail,
  TableColumn,
  TableEntry,
  TableEntryKind,
  RolledDie,
  RollResult,
  RollResultItem,
} from '../types/randomTable';
import type { Generator, GeneratorComponent, GeneratorDetail, GeneratorRollResult, GeneratorRollSlotResult } from '../types/generator';
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
  return {
    id: c.id,
    worldId: c.world_id,
    name: c.name,
    imageSrc: assetFileUrl(c.image_asset_id),
    description: c.description ?? '',
    ruleset: c.ruleset ?? '',
    createdAt: toEpochMs(c.created_at),
    updatedAt: toEpochMs(c.updated_at),
  };
}

// ---------------------------------------------------------------------
// World
// ---------------------------------------------------------------------

export function apiWorldToWorld(w: ApiWorld): World {
  return {
    id: w.id,
    name: w.name,
    imageSrc: assetFileUrl(w.image_asset_id),
    description: w.description ?? '',
    createdAt: toEpochMs(w.created_at),
    updatedAt: toEpochMs(w.updated_at),
  };
}

// ---------------------------------------------------------------------
// Articles / article folders
// ---------------------------------------------------------------------

export function apiArticleFolderToArticleFolder(f: ApiArticleFolder): ArticleFolder {
  return {
    id: f.id,
    worldId: f.world_id,
    parentId: f.parent_id,
    name: f.name,
  };
}

export function articleFolderToApiPayload(folder: ArticleFolder): Record<string, unknown> {
  return {
    id: folder.id,
    world_id: folder.worldId,
    parent_id: folder.parentId,
    name: folder.name,
  };
}

function fieldValuesFromJson(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[key] = v;
  }
  return out;
}

export function apiArticleToArticle(a: ApiArticle): Article {
  return {
    id: a.id,
    worldId: a.world_id,
    folderId: a.folder_id,
    category: a.category as ArticleCategory,
    name: a.name,
    coverImageSrc: assetFileUrl(a.cover_image_asset_id),
    tags: toStringArray(a.tags),
    visibility: a.visibility as ArticleVisibility,
    fieldValues: fieldValuesFromJson(a.field_values),
    body: a.body,
    linkedEntityType: (a.linked_entity_type as Article['linkedEntityType']) ?? null,
    linkedEntityId: a.linked_entity_id,
    createdAt: toEpochMs(a.created_at),
    updatedAt: toEpochMs(a.updated_at),
  };
}

/** The rich text editor inserts images as local blob: preview URLs (TipTapArticleEditor's
 * toolbar, same as the cover image picker) - swap each one for its real uploaded asset URL
 * before the article body is persisted, since a blob: URL only lives as long as the page. */
async function resolveInlineBodyImages(body: string): Promise<string> {
  const blobUrls = Array.from(new Set(Array.from(body.matchAll(/<img[^>]+src="(blob:[^"]+)"/g), (m) => m[1])));
  if (blobUrls.length === 0) return body;
  let resolved = body;
  for (const blobUrl of blobUrls) {
    const { url } = await resolveImageAsset(blobUrl, 'article_body_image');
    resolved = resolved.split(`"${blobUrl}"`).join(`"${url}"`);
  }
  return resolved;
}

export async function articleToApiPayload(article: Article): Promise<Record<string, unknown>> {
  const { assetId } = await resolveImageAsset(article.coverImageSrc, 'article_cover_image');
  const body = await resolveInlineBodyImages(article.body);
  return {
    id: article.id,
    world_id: article.worldId,
    folder_id: article.folderId,
    category: article.category,
    name: article.name,
    cover_image_asset_id: assetId,
    tags: article.tags,
    visibility: article.visibility,
    field_values: article.fieldValues,
    body,
    linked_entity_type: article.linkedEntityType,
    linked_entity_id: article.linkedEntityId,
  };
}

// ---------------------------------------------------------------------
// Notes / note folders
// ---------------------------------------------------------------------

export function apiNoteFolderToNoteFolder(f: ApiNoteFolder): NoteFolder {
  return {
    id: f.id,
    campaignId: f.campaign_id,
    parentId: f.parent_id,
    name: f.name,
    isDefault: f.is_default,
    defaultKind: f.default_kind,
    createdAt: toEpochMs(f.created_at),
    updatedAt: toEpochMs(f.updated_at),
  };
}

export function noteFolderToApiPayload(folder: NoteFolder): Record<string, unknown> {
  return {
    id: folder.id,
    campaign_id: folder.campaignId,
    parent_id: folder.parentId,
    name: folder.name,
    is_default: folder.isDefault,
    default_kind: folder.defaultKind,
  };
}

export function apiNoteToNote(n: ApiNote): Note {
  const docType = NOTE_DOC_TYPES.includes(n.doc_type as NoteDocType) ? (n.doc_type as NoteDocType) : 'text';
  return {
    id: n.id,
    campaignId: n.campaign_id,
    folderId: n.folder_id,
    name: n.name,
    kind: (n.kind as NoteKind | null) ?? null,
    docType,
    body: n.body,
    // Normalized here, once, so no screen ever touches a raw persisted canvas - see
    // noteCanvas.ts on why (fields added after a board was saved).
    canvas: asCanvas(docType, n.canvas),
    tags: toStringArray(n.tags),
    createdAt: toEpochMs(n.created_at),
    updatedAt: toEpochMs(n.updated_at),
  };
}

export function noteToApiPayload(note: Note): Record<string, unknown> {
  return {
    id: note.id,
    campaign_id: note.campaignId,
    folder_id: note.folderId,
    name: note.name,
    kind: note.kind,
    doc_type: note.docType,
    body: note.body,
    canvas: note.canvas,
    tags: note.tags,
  };
}

export function apiSessionChatToSessionChat(c: ApiSessionChat): SessionChat {
  return {
    id: c.id,
    campaignId: c.campaign_id,
    noteId: c.note_id,
    name: c.name,
    messages: c.messages.map((m) => ({ id: m.id, text: m.text, createdAt: m.createdAt, editedAt: m.editedAt })),
    createdAt: toEpochMs(c.created_at),
    updatedAt: toEpochMs(c.updated_at),
  };
}

export function sessionChatToApiPayload(chat: SessionChat): Record<string, unknown> {
  return {
    id: chat.id,
    campaign_id: chat.campaignId,
    note_id: chat.noteId,
    name: chat.name,
    messages: chat.messages,
  };
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
    edition: c.edition,
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
    description: c.description ?? undefined,
    appearance: c.appearance ?? undefined,
    secrets: c.secrets ?? undefined,
    relationships: c.relationships ?? undefined,
    baseCreatureId: c.base_creature_id ?? undefined,
    isCustomBuild: c.is_custom_build ?? true,
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
    description: isNpc ? (creature.description ?? null) : null,
    appearance: isNpc ? (creature.appearance ?? null) : null,
    secrets: isNpc ? (creature.secrets ?? null) : null,
    relationships: isNpc ? (creature.relationships ?? null) : null,
    base_creature_id: isNpc ? (creature.baseCreatureId ?? null) : null,
    is_custom_build: isNpc ? creature.isCustomBuild : true,
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

/** MapToken.raw_data has no other use yet - same JSONB-overflow-column convention as
 * floor.raw_data (initiative) and quest.raw_data, used here so tempHp/reactionSpent don't
 * need their own migration/columns. */
function tokenExtrasFromRawData(rawData: unknown): {
  tempHp?: number;
  reactionSpent?: boolean;
  visionRadius?: number;
} {
  if (!rawData || typeof rawData !== 'object') return {};
  const o = rawData as Record<string, unknown>;
  return {
    tempHp: typeof o.tempHp === 'number' ? o.tempHp : undefined,
    reactionSpent: typeof o.reactionSpent === 'boolean' ? o.reactionSpent : undefined,
    visionRadius: typeof o.visionRadius === 'number' ? o.visionRadius : undefined,
  };
}

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
    ...tokenExtrasFromRawData(t.raw_data),
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

/** Reads the fog mask back out of the floor's raw_data. Every floor saved
 * before fog existed has no `fog` key at all, and one whose background image
 * was swapped has a mask sized for the old image - both have to come back as
 * "fog off, nothing explored" rather than as a half-valid state. */
function fogFromRawData(rawData: unknown): FogState {
  if (rawData && typeof rawData === 'object' && 'fog' in (rawData as Record<string, unknown>)) {
    const stored = (rawData as Record<string, unknown>).fog;
    if (stored && typeof stored === 'object') {
      const o = stored as Partial<FogState>;
      return {
        enabled: typeof o.enabled === 'boolean' ? o.enabled : false,
        cols: typeof o.cols === 'number' ? o.cols : 0,
        rows: typeof o.rows === 'number' ? o.rows : 0,
        explored: typeof o.explored === 'string' ? o.explored : '',
      };
    }
  }
  return { ...DEFAULT_FOG_STATE };
}

/** The canvas size this floor's contents were authored against - see MapFloor.authoredStage.
 * Absent on every floor saved before token positions were made viewport-independent; those
 * get one migrated in on first load. */
function authoredStageFromRawData(rawData: unknown): { width: number; height: number } | undefined {
  if (rawData && typeof rawData === 'object' && 'authoredStage' in (rawData as Record<string, unknown>)) {
    const stored = (rawData as Record<string, unknown>).authoredStage;
    if (stored && typeof stored === 'object') {
      const o = stored as Partial<{ width: number; height: number }>;
      if (typeof o.width === 'number' && o.width > 0 && typeof o.height === 'number' && o.height > 0) {
        return { width: o.width, height: o.height };
      }
    }
  }
  return undefined;
}

/** map_floors.walls is a JSONB column that predates this feature and has
 * always been null in practice, so anything that is not a well-formed array
 * of polylines degrades to "no walls". */
function wallsFromApi(walls: unknown): WallSegment[] {
  if (!Array.isArray(walls)) return [];
  const result: WallSegment[] = [];
  for (const entry of walls) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Partial<WallSegment>;
    if (!Array.isArray(o.points) || o.points.length < 4) continue;
    if (o.points.some((n) => typeof n !== 'number' || !Number.isFinite(n))) continue;
    result.push({ id: typeof o.id === 'string' ? o.id : crypto.randomUUID(), points: o.points });
  }
  return result;
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
    walls: wallsFromApi(floor.walls),
    fog: fogFromRawData(floor.raw_data),
    authoredStage: authoredStageFromRawData(floor.raw_data),
  };
}

/** Merges a WS-pushed `floor:updated` payload (flip/rotation/locked-encounter/initiative) into
 * local floor state, leaving placedTokens/shapes untouched - those broadcast separately via
 * their own token/shape messages. See MapPage's floorRoom WS handler. */
export function applyApiFloorMetaPatch(floor: MapFloor, data: ApiMapFloor): MapFloor {
  // Walls and fog keep their PREVIOUS references when the incoming content is
  // identical. REST writes broadcast into the floor's WS room with no sender to
  // exclude, so the client receives an echo of its own every save - and a
  // freshly-parsed walls array or fog object would be a new identity each time,
  // invalidating MapPage's line-of-sight memo and re-running the whole sweep,
  // mask and render pass for a payload that did not actually change. That echo
  // is most of what made dragging a token stutter.
  const nextWalls = wallsFromApi(data.walls);
  const nextFog = fogFromRawData(data.raw_data);
  const wallsUnchanged = JSON.stringify(nextWalls) === JSON.stringify(floor.walls);
  const fogUnchanged = JSON.stringify(nextFog) === JSON.stringify(floor.fog);

  return {
    ...floor,
    flippedHorizontal: data.flipped_horizontal,
    flippedVertical: data.flipped_vertical,
    rotation: data.rotation,
    lockedEncounterId: data.locked_encounter_id,
    resolvedEncounterRoster: resolvedRosterFromRawData(data.raw_data),
    initiative: initiativeFromRawData(data.raw_data),
    walls: wallsUnchanged ? floor.walls : nextWalls,
    fog: fogUnchanged ? floor.fog : nextFog,
    authoredStage: authoredStageFromRawData(data.raw_data) ?? floor.authoredStage,
  };
}

// ---------------------------------------------------------------------
// Encounter
// ---------------------------------------------------------------------

function apiEncounterCreatureToEntry(e: ApiEncounterCreature): EncounterCreatureEntry {
  return {
    id: e.id,
    creatureId: e.creature_id,
    name: e.creature_id ? (e.creature_name ?? 'Creature') : (e.custom_name ?? 'Creature'),
    imageSrc: assetFileUrl(e.token_asset_id ?? e.portrait_asset_id ?? e.custom_image_asset_id),
    quantity: e.quantity,
    quantityFormula: e.quantity_formula ?? null,
    size: e.size_override ?? undefined,
    role: (e.role as CombatRole | null) ?? null,
    notes: e.notes,
    cr: e.creature_cr ?? null,
  };
}

function apiEncounterNpcToEntry(n: ApiEncounterNpc): EncounterNpcEntry {
  return {
    id: n.id,
    npcId: n.npc_id,
    name: n.npc_name ?? 'NPC',
    imageSrc: assetFileUrl(n.token_asset_id ?? n.portrait_asset_id),
    attitude: (n.attitude as NpcAttitude | null) ?? null,
    agenda: (n.agenda as NpcAgenda | null) ?? null,
    secret: n.secret,
    leverage: n.leverage,
    rpCues: (n.rp_cues as RpCues | null) ?? null,
    sortOrder: n.sort_order,
  };
}

function apiCombatBlockToBlock(b: ApiEncounterCombatBlock): EncounterCombatBlock {
  return {
    shape: b.shape,
    victoryCondition: b.victory_condition,
    awareness: b.awareness,
    startRange: b.start_range,
    lighting: b.lighting,
    terrainType: b.terrain_type,
    terrainFeatures: b.terrain_features,
    morale: b.morale,
    reinforcements: b.reinforcements ? { mode: b.reinforcements.mode, trigger: b.reinforcements.trigger, round: b.reinforcements.round, tableId: b.reinforcements.table_id } : null,
    dynamicEvents: (b.dynamic_events as { trigger: string; event: string }[]) ?? [],
    difficultyBand: b.difficulty_band,
    computedXp: b.computed_xp,
    hasLairOrLegendary: b.has_lair_or_legendary,
    aftermath: b.aftermath,
    scalingNotes: b.scaling_notes,
    mapId: b.map_id,
    transitionEncounterId: b.transition_encounter_id,
  };
}

export function combatBlockToApiPayload(b: EncounterCombatBlock): Record<string, unknown> {
  return {
    shape: b.shape, victory_condition: b.victoryCondition, awareness: b.awareness, start_range: b.startRange,
    lighting: b.lighting, terrain_type: b.terrainType, terrain_features: b.terrainFeatures, morale: b.morale,
    reinforcements: b.reinforcements ? { mode: b.reinforcements.mode, trigger: b.reinforcements.trigger, round: b.reinforcements.round, table_id: b.reinforcements.tableId } : null, dynamic_events: b.dynamicEvents, difficulty_band: b.difficultyBand,
    computed_xp: b.computedXp, has_lair_or_legendary: b.hasLairOrLegendary, aftermath: b.aftermath,
    scaling_notes: b.scalingNotes, map_id: b.mapId, transition_encounter_id: b.transitionEncounterId,
  };
}

function apiSocialBlockToBlock(b: ApiEncounterSocialBlock): EncounterSocialBlock {
  return {
    shape: b.shape,
    venue: b.venue,
    tone: b.tone,
    stakes: b.stakes,
    playerLevers: b.player_levers,
    keyChecks: (b.key_checks as { skill: string; dc: number; onSuccess: string; onFailure: string }[]) ?? [],
    outcomeTiers: b.outcome_tiers,
    socialClock: (b.social_clock as { successesNeeded: number; failuresAllowed: number } | null) ?? null,
    gatedInfo: (b.gated_info as { fact: string; revealWhen: string }[]) ?? [],
    complications: b.complications,
    escalation: b.escalation,
    transitionEncounterId: b.transition_encounter_id,
  };
}

export function socialBlockToApiPayload(b: EncounterSocialBlock): Record<string, unknown> {
  return {
    shape: b.shape, venue: b.venue, tone: b.tone, stakes: b.stakes, player_levers: b.playerLevers,
    key_checks: b.keyChecks, outcome_tiers: b.outcomeTiers, social_clock: b.socialClock,
    gated_info: b.gatedInfo, complications: b.complications, escalation: b.escalation,
    transition_encounter_id: b.transitionEncounterId,
  };
}

function apiExplorationBlockToBlock(b: ApiEncounterExplorationBlock): EncounterExplorationBlock {
  return {
    shape: b.shape,
    environment: b.environment,
    terrainDifficulty: b.terrain_difficulty,
    obstacleType: b.obstacle_type,
    trap: b.trap ? { name: b.trap.name, trigger: b.trap.trigger, detectDc: b.trap.detect_dc, disableDc: b.trap.disable_dc, effect: b.trap.effect, damageFormula: b.trap.damage_formula, damageType: b.trap.damage_type, conditionIds: b.trap.condition_ids ?? [] } : null,
    hazard: b.hazard ? { name: b.hazard.name, saveAbility: b.hazard.save_ability, saveDc: b.hazard.save_dc, effect: b.hazard.effect, damageFormula: b.hazard.damage_formula, damageType: b.hazard.damage_type, conditionIds: b.hazard.condition_ids ?? [] } : null,
    skillChallenge: b.skill_challenge ? { goal: b.skill_challenge.goal, successesRequired: b.skill_challenge.successes_required, failuresAllowed: b.skill_challenge.failures_allowed, skills: b.skill_challenge.skills } : null,
    puzzle: b.puzzle,
    sensoryClues: (b.sensory_clues as { sense: string; detail: string; perceiveDc: number | null }[]) ?? [],
    pointsOfInterest: (b.points_of_interest as { name: string; hidden?: boolean; revealWhen?: string; rewardOrInfo?: string }[]) ?? [],
    navigation: b.navigation,
    resourceCost: b.resource_cost,
    verticality: b.verticality,
    complications: b.complications,
    transitionEncounterId: b.transition_encounter_id,
    wanderingTableId: b.wandering_table_id,
  };
}

export function explorationBlockToApiPayload(b: EncounterExplorationBlock): Record<string, unknown> {
  return {
    shape: b.shape, environment: b.environment, terrain_difficulty: b.terrainDifficulty,
    obstacle_type: b.obstacleType,
    trap: b.trap ? { name: b.trap.name, trigger: b.trap.trigger, detect_dc: b.trap.detectDc, disable_dc: b.trap.disableDc, effect: b.trap.effect, damage_formula: b.trap.damageFormula, damage_type: b.trap.damageType, condition_ids: b.trap.conditionIds } : null,
    hazard: b.hazard ? { name: b.hazard.name, save_ability: b.hazard.saveAbility, save_dc: b.hazard.saveDc, effect: b.hazard.effect, damage_formula: b.hazard.damageFormula, damage_type: b.hazard.damageType, condition_ids: b.hazard.conditionIds } : null,
    skill_challenge: b.skillChallenge ? { goal: b.skillChallenge.goal, successes_required: b.skillChallenge.successesRequired, failures_allowed: b.skillChallenge.failuresAllowed, skills: b.skillChallenge.skills } : null,
    puzzle: b.puzzle, sensory_clues: b.sensoryClues, points_of_interest: b.pointsOfInterest,
    navigation: b.navigation, resource_cost: b.resourceCost, verticality: b.verticality,
    complications: b.complications, transition_encounter_id: b.transitionEncounterId, wandering_table_id: b.wanderingTableId,
  };
}

function apiEncounterTableCreatureToEntry(c: ApiEncounterTableCreature): RandomTableCreature {
  return {
    id: c.id,
    creatureId: c.creature_id,
    name: c.creature_name ?? c.creature_name_raw,
    type: c.creature_type,
    imageSrc: assetFileUrl(c.token_asset_id ?? c.portrait_asset_id),
    quantityFormula: c.quantity_formula,
    cr: c.creature_cr ?? null,
  };
}

export function apiEncounterToEncounter(e: ApiEncounterDetail): Encounter {
  return {
    id: e.id,
    name: e.name,
    description: e.description ?? '',
    challengeRating: e.challenge_rating_display ?? '',
    computedXp: e.computed_adjusted_xp,
    difficulty: e.difficulty,
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
      creatures: t.creatures.map((c) => apiEncounterTableCreatureToEntry(c)),
    })),
    creatures: e.creatures.map((entry) => apiEncounterCreatureToEntry(entry)),
    createdAt: toEpochMs(e.created_at),
    updatedAt: toEpochMs(e.updated_at),
    primaryType: (e.primary_type as EncounterPrimaryType | null) ?? null,
    categoryId: e.category_id,
    status: (e.status as EncounterStatus) ?? 'draft',
    readAloud: e.read_aloud,
    objective: e.objective,
    partyLevelMin: e.party_level_min,
    partyLevelMax: e.party_level_max,
    partySize: e.party_size,
    scalingNotes: e.scaling_notes,
    locationId: e.location_id,
    generatorId: e.generator_id ?? null,
    rewards: (Array.isArray(e.rewards) ? e.rewards : []).map((r, i) => ({
      kind: r.kind,
      itemId: r.item_id ?? null,
      description: r.description ?? '',
      quantity: r.quantity ?? 1,
      sortOrder: r.sort_order ?? i,
      itemName: r.item_name ?? null,
      itemRarity: r.item_rarity ?? null,
    })),
    tagIds: e.tag_ids ?? [],
    npcs: (e.npcs ?? []).map((n) => apiEncounterNpcToEntry(n)),
    combatBlock: e.combat_block ? apiCombatBlockToBlock(e.combat_block) : null,
    socialBlock: e.social_block ? apiSocialBlockToBlock(e.social_block) : null,
    explorationBlock: e.exploration_block ? apiExplorationBlockToBlock(e.exploration_block) : null,
  };
}

export function encounterToApiPayload(encounter: Encounter, campaignId: string): Record<string, unknown> {
  return {
    campaign_id: campaignId,
    name: encounter.name,
    description: encounter.description || null,
    challenge_rating_display: encounter.challengeRating || null,
    computed_adjusted_xp: encounter.computedXp,
    difficulty: encounter.difficulty,
    theme: encounter.theme || null,
    encounter_type: encounter.encounterType ?? null,
    possible_locations: encounter.possibleLocations ?? null,
    tags: encounter.tags,
    resolution_type: encounter.resolutionType,
    page: encounter.page ?? null,
    tables: encounter.tables ?? null,
    primary_type: encounter.primaryType,
    category_id: encounter.categoryId,
    status: encounter.status,
    read_aloud: encounter.readAloud,
    objective: encounter.objective,
    party_level_min: encounter.partyLevelMin,
    party_level_max: encounter.partyLevelMax,
    party_size: encounter.partySize,
    scaling_notes: encounter.scalingNotes,
    location_id: encounter.locationId,
    generator_id: encounter.generatorId ?? null,
    rewards: encounter.rewards.map((r, i) => ({
      kind: r.kind,
      // Only an item reward carries the FK - see the server's _replace_rewards.
      item_id: r.kind === 'item' ? r.itemId : null,
      description: r.description,
      quantity: r.quantity,
      sort_order: r.sortOrder ?? i,
    })),
  };
}

export function encounterEntryToApiPayload(entry: EncounterCreatureEntry): Record<string, unknown> {
  return {
    creature_id: entry.creatureId,
    custom_name: entry.creatureId ? null : entry.name,
    quantity: entry.quantity,
    raw_data: entry.quantityFormula ? { quantity_formula: entry.quantityFormula } : null,
    size_override: entry.size ?? null,
    role: entry.role ?? null,
    notes: entry.notes ?? null,
  };
}

export function encounterNpcToApiPayload(entry: EncounterNpcEntry): Record<string, unknown> {
  return {
    npc_id: entry.npcId,
    attitude: entry.attitude,
    agenda: entry.agenda,
    secret: entry.secret,
    leverage: entry.leverage,
    rp_cues: entry.rpCues,
    sort_order: entry.sortOrder,
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
    influence: (f.influence as FactionInfluence) ?? 'regional',
    createdAt: toEpochMs(f.created_at),
    updatedAt: toEpochMs(f.updated_at),
  };
}

export async function factionToApiPayload(faction: Faction, campaignId: string): Promise<Record<string, unknown>> {
  const { assetId } = await resolveImageAsset(faction.imageSrc, 'faction_image');
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
    image_asset_id: assetId,
    governance: faction.governance || null,
    power: faction.power,
    power_label: faction.powerLabel || null,
    location_summary: faction.locationSummary || null,
    military: faction.military,
    naval: faction.naval,
    economy: faction.economy,
    reputation: faction.reputation,
    influence: faction.influence,
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
    importance: (r.importance as FactionRelationImportance) ?? 'secondary',
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
    importance: relation.importance,
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

// ---------------------------------------------------------------------
// Category / Tag / TableFormat / RandomTable / Generator
// ---------------------------------------------------------------------

export function apiCategoryNodeToNode(c: ApiCategoryNode): CategoryNode {
  return {
    id: c.id, slug: c.slug, name: c.name, parentId: c.parent_id, isSystem: c.is_system,
    icon: c.icon, sortOrder: c.sort_order, children: c.children.map(apiCategoryNodeToNode),
  };
}

export function apiCategoryToCategory(c: ApiCategory): Category {
  return { id: c.id, slug: c.slug, name: c.name, parentId: c.parent_id, isSystem: c.is_system, icon: c.icon, sortOrder: c.sort_order };
}

export function categoryToApiPayload(c: { slug: string; name: string; parentId: string | null; icon?: string | null; sortOrder?: number }): Record<string, unknown> {
  return { slug: c.slug, name: c.name, parent_id: c.parentId, icon: c.icon ?? null, sort_order: c.sortOrder ?? 0 };
}

export function apiTagToTag(t: ApiTag): Tag {
  return { id: t.id, namespace: t.namespace, value: t.value, label: t.label, isSystem: t.is_system };
}

export function apiTableFormatToTableFormat(f: ApiTableFormat): TableFormat {
  return { id: f.id, slug: f.slug, name: f.name, description: f.description, tier: f.tier, isSystem: f.is_system };
}

function apiTableEntryToEntry(e: ApiTableEntry): TableEntry {
  return {
    id: e.id, columnId: e.column_id, min: e.min, max: e.max, secondaryMin: e.secondary_min, secondaryMax: e.secondary_max,
    weight: e.weight, kind: e.kind, text: e.text, encounterId: e.encounter_id, targetTableId: e.target_table_id,
    creatureId: e.creature_id, npcId: e.npc_id, itemId: e.item_id, bundle: e.bundle, notes: e.notes,
    sortOrder: e.sort_order, tagIds: e.tag_ids, refHydrated: e.ref_hydrated,
  };
}

export function tableEntryToApiPayload(e: Partial<TableEntry> & { kind: TableEntryKind }): Record<string, unknown> {
  return {
    id: e.id, min: e.min ?? null, max: e.max ?? null, secondary_min: e.secondaryMin ?? null, secondary_max: e.secondaryMax ?? null,
    weight: e.weight ?? null, kind: e.kind, text: e.text ?? null, encounter_id: e.encounterId ?? null,
    target_table_id: e.targetTableId ?? null, creature_id: e.creatureId ?? null, npc_id: e.npcId ?? null,
    item_id: e.itemId ?? null, bundle: e.bundle ?? null, notes: e.notes ?? null, sort_order: e.sortOrder ?? 0,
    tag_ids: e.tagIds ?? [],
  };
}

function apiTableColumnToColumn(c: ApiTableColumn): TableColumn {
  return {
    id: c.id, tableId: c.table_id, name: c.name, dieCount: c.die_count, dieSides: c.die_sides,
    dieModifier: c.die_modifier, sortOrder: c.sort_order, entries: c.entries.map(apiTableEntryToEntry),
  };
}

export function tableColumnToApiPayload(c: Partial<TableColumn> & { name: string; entries: TableEntry[] }): Record<string, unknown> {
  return {
    id: c.id, name: c.name, die_count: c.dieCount ?? 1, die_sides: c.dieSides ?? 20, die_modifier: c.dieModifier ?? 0,
    sort_order: c.sortOrder ?? 0, entries: c.entries.map(tableEntryToApiPayload),
  };
}

export function apiRandomTableToTable(t: ApiRandomTable): RandomTable {
  return {
    id: t.id, campaignId: t.campaign_id, name: t.name, description: t.description, categoryId: t.category_id,
    formatId: t.format_id, triggerSituation: t.trigger_situation, imageUrl: t.image_url, combineTemplate: t.combine_template,
    sourceBook: t.source_book, formatConfig: (t.format_config as Record<string, unknown> | null) ?? null,
    isSystem: t.is_system, createdAt: toEpochMs(t.created_at), updatedAt: toEpochMs(t.updated_at), tagIds: t.tag_ids,
  };
}

export function apiRandomTableDetailToDetail(t: ApiRandomTableDetail): RandomTableDetail {
  return { ...apiRandomTableToTable(t), columns: t.columns.map(apiTableColumnToColumn) };
}

export function randomTableToApiPayload(
  t: Pick<RandomTable, 'name' | 'description' | 'categoryId' | 'formatId' | 'triggerSituation' | 'imageUrl' | 'combineTemplate' | 'sourceBook' | 'formatConfig' | 'tagIds'> & { campaignId?: string | null },
): Record<string, unknown> {
  return {
    campaign_id: t.campaignId ?? null, name: t.name, description: t.description || null, category_id: t.categoryId,
    format_id: t.formatId, trigger_situation: t.triggerSituation || null, image_url: t.imageUrl || null,
    combine_template: t.combineTemplate || null, source_book: t.sourceBook || null, format_config: t.formatConfig,
    tag_ids: t.tagIds,
  };
}

function apiRolledDieToDie(d: ApiRolledDie): RolledDie {
  return { sides: d.sides, result: d.result };
}

function apiRollResultItemToItem(i: ApiRollResultItem): RollResultItem {
  return {
    columnName: i.column_name, dice: i.dice.map(apiRolledDieToDie), total: i.total, entryId: i.entry_id, kind: i.kind,
    text: i.text, resolvedText: i.resolved_text, refId: i.ref_id, refHydrated: i.ref_hydrated, extra: i.extra,
    tagIds: i.tag_ids ?? [],
    nested: i.nested ? apiRollResultToResult(i.nested) : null,
  };
}

export function apiRollResultToResult(r: ApiRollResult): RollResult {
  return {
    tableId: r.table_id, tableName: r.table_name, formatSlug: r.format_slug, items: r.items.map(apiRollResultItemToItem),
    combinedText: r.combined_text, gatePassed: r.gate_passed,
  };
}

export function apiGeneratorToGenerator(g: ApiGenerator): Generator {
  return {
    id: g.id, campaignId: g.campaign_id, slug: g.slug, name: g.name, categoryId: g.category_id, description: g.description,
    combineTemplate: g.combine_template,
    parameters: g.parameters.map((p) => ({ key: p.key, label: p.label, type: p.type, allowedTags: p.allowed_tags, required: p.required, default: p.default })),
    isSystem: g.is_system, createdAt: toEpochMs(g.created_at), updatedAt: toEpochMs(g.updated_at), tagIds: g.tag_ids,
  };
}

function apiGeneratorComponentToComponent(c: ApiGeneratorComponent): GeneratorComponent {
  return {
    id: c.id, generatorId: c.generator_id, tableId: c.table_id, outputSlot: c.output_slot,
    filterParamKey: c.filter_param_key, rollCount: c.roll_count, optional: c.optional, sortOrder: c.sort_order,
  };
}

export function apiGeneratorDetailToDetail(g: ApiGeneratorDetail): GeneratorDetail {
  return { ...apiGeneratorToGenerator(g), components: g.components.map(apiGeneratorComponentToComponent) };
}

export function generatorToApiPayload(
  g: Pick<Generator, 'slug' | 'name' | 'categoryId' | 'description' | 'combineTemplate' | 'parameters' | 'tagIds'> & { campaignId?: string | null },
): Record<string, unknown> {
  return {
    campaign_id: g.campaignId ?? null, slug: g.slug, name: g.name, category_id: g.categoryId, description: g.description || null,
    combine_template: g.combineTemplate,
    parameters: g.parameters.map((p) => ({ key: p.key, label: p.label, type: p.type, allowed_tags: p.allowedTags, required: p.required, default: p.default })),
    tag_ids: g.tagIds,
  };
}

export function generatorComponentToApiPayload(c: Pick<GeneratorComponent, 'tableId' | 'outputSlot' | 'filterParamKey' | 'rollCount' | 'optional' | 'sortOrder'> & { id?: string }): Record<string, unknown> {
  return {
    id: c.id, table_id: c.tableId, output_slot: c.outputSlot, filter_param_key: c.filterParamKey,
    roll_count: c.rollCount, optional: c.optional, sort_order: c.sortOrder,
  };
}

function apiGeneratorRollSlotResultToResult(s: ApiGeneratorRollSlotResult): GeneratorRollSlotResult {
  return {
    slot: s.slot, tableId: s.table_id, tableName: s.table_name,
    result: s.result ? apiRollResultItemToItem(s.result) : null, skipped: s.skipped,
  };
}

export function apiGeneratorRollResultToResult(r: ApiGeneratorRollResult): GeneratorRollResult {
  return { generatorId: r.generator_id, slots: r.slots.map(apiGeneratorRollSlotResultToResult), combinedText: r.combined_text };
}

// ---------------------------------------------------------------------------
// Entity revisions (World Manager edit history)
// ---------------------------------------------------------------------------

/** The server sends `delta` / `before_count` / `after_count` as null on the change kinds
 * that do not use them. They become absent rather than null here so the domain type can say
 * "present only on `long`" with an optional field instead of a nullable one. */
function apiRevisionChangeToChange(c: ApiRevisionChange): RevisionChange {
  return {
    field: c.field,
    label: c.label,
    kind: c.kind,
    before: c.before,
    after: c.after,
    ...(c.delta != null ? { delta: c.delta } : {}),
    ...(c.before_count != null ? { beforeCount: c.before_count } : {}),
    ...(c.after_count != null ? { afterCount: c.after_count } : {}),
  };
}

export function apiEntityRevisionToRevision(r: ApiEntityRevision): EntityRevision {
  return {
    id: r.id,
    worldId: r.world_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    entityName: r.entity_name,
    action: r.action,
    summary: r.summary,
    changes: (r.changes ?? []).map(apiRevisionChangeToChange),
    createdAt: toEpochMs(r.created_at),
    canRestore: r.can_restore,
  };
}

export function apiRestoreResultToResult(r: ApiRestoreResult): RevisionRestoreResult {
  return {
    entityType: r.entity_type,
    entityId: r.entity_id,
    entityName: r.entity_name,
    recreated: r.recreated,
    revision: r.revision ? apiEntityRevisionToRevision(r.revision) : null,
  };
}

export function apiRetentionPolicyToPolicy(p: ApiRetentionPolicy): RevisionRetentionPolicy {
  return { windowHours: p.window_hours, minRows: p.min_rows };
}
