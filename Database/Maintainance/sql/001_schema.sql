-- WorldWatcher database schema
-- Generated from Database/Maintainance/database_scehma.txt (design doc).
-- Implements all 23 tables described there. Do not hand-edit generated
-- pieces without also updating the design doc - it is the source of truth.
--
-- Safe to re-run: every statement is IF NOT EXISTS / CREATE OR REPLACE.

BEGIN;

-- ============================================================
-- 0. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy name search (gin_trgm_ops)

-- Shared trigger: keep updated_at current on every UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. sources
-- ============================================================
CREATE TABLE IF NOT EXISTS sources (
  id                 UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name               TEXT          NOT NULL,
  abbreviation       TEXT          NOT NULL,
  edition            TEXT          NULL,
  source_type        TEXT          NOT NULL
    CHECK (source_type IN ('core','supplement','adventure','homebrew','srd','unearthed_arcana')),
  publisher          TEXT          NULL,
  publication_date   DATE          NULL,
  page               INTEGER       NULL,
  license            TEXT          NULL,
  description        TEXT          NULL,
  raw_data           JSONB         NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (abbreviation, edition)
);
CREATE INDEX IF NOT EXISTS sources_abbreviation_idx ON sources (abbreviation);
-- The plain UNIQUE(abbreviation, edition) above only catches conflicts when
-- edition IS NOT NULL (standard SQL NULL-distinct semantics). Most 5etools
-- sources import with edition = NULL, so a partial unique index is needed
-- to actually enforce "one row per abbreviation" in that common case.
CREATE UNIQUE INDEX IF NOT EXISTS sources_abbr_null_edition_uidx ON sources (abbreviation) WHERE edition IS NULL;
DROP TRIGGER IF EXISTS trg_sources_updated_at ON sources;
CREATE TRIGGER trg_sources_updated_at BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. assets
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename       TEXT          NOT NULL,
  storage_path   TEXT          NOT NULL,
  asset_type     TEXT          NOT NULL
    CHECK (asset_type IN ('creature_portrait','creature_token','item_image','map','npc_portrait',
                           'faction_image','location_image','spell_image','character_portrait',
                           'character_token','bastion_facility_image','article_cover_image','other')),
  mime_type      TEXT          NULL,
  width          INTEGER       NULL,
  height         INTEGER       NULL,
  file_size      BIGINT        NULL,
  sha256         TEXT          NOT NULL UNIQUE,
  source         TEXT          NULL,
  source_path    TEXT          NULL,
  raw_data       JSONB         NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assets_asset_type_idx ON assets (asset_type);
CREATE INDEX IF NOT EXISTS assets_storage_path_idx ON assets (storage_path);

-- ============================================================
-- 2b. worlds
-- ============================================================
-- The setting - reusable across one or more Campaigns (play-throughs). Added
-- for the World -> Campaign scope split (Prompt Images/WorldWatcher UI
-- redisgn.md section 2); not part of the original 23-table design doc.
CREATE TABLE IF NOT EXISTS worlds (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT          NOT NULL,
  description    TEXT          NULL,
  image_asset_id UUID          NULL REFERENCES assets (id),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_worlds_updated_at ON worlds;
CREATE TRIGGER trg_worlds_updated_at BEFORE UPDATE ON worlds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  world_id       UUID          NOT NULL REFERENCES worlds (id),
  name           TEXT          NOT NULL,
  description    TEXT          NULL,
  image_asset_id UUID          NULL REFERENCES assets (id),
  ruleset        TEXT          NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_world_id_idx ON campaigns (world_id);
DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON campaigns;
CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3b. article_folders / articles
-- ============================================================
-- World Anvil-style wiki entries - promoted from a frontend-only localStorage
-- prototype (useArticleStore). One generic `articles` table backs every
-- ArticleCategory from types/article.ts's ARTICLE_TEMPLATES; per-category
-- template fields live in field_values (JSONB) instead of one column per
-- field, so new categories/fields don't need a migration. linked_entity_type/
-- linked_entity_id back an in-progress article<->NPC/Creature/Spell/Item
-- bridging feature - loose reference, no FK, since the target table varies.
CREATE TABLE IF NOT EXISTS article_folders (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  world_id       UUID          NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  parent_id      UUID          NULL REFERENCES article_folders (id) ON DELETE CASCADE,
  name           TEXT          NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS article_folders_world_id_idx ON article_folders (world_id);
CREATE INDEX IF NOT EXISTS article_folders_parent_id_idx ON article_folders (parent_id);
DROP TRIGGER IF EXISTS trg_article_folders_updated_at ON article_folders;
CREATE TRIGGER trg_article_folders_updated_at BEFORE UPDATE ON article_folders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS articles (
  id                  UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  world_id            UUID          NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  folder_id           UUID          NULL REFERENCES article_folders (id) ON DELETE SET NULL,
  category            TEXT          NOT NULL,
  name                TEXT          NOT NULL,
  cover_image_asset_id UUID         NULL REFERENCES assets (id),
  tags                JSONB         NOT NULL DEFAULT '[]'::jsonb,
  visibility          TEXT          NOT NULL DEFAULT 'gm',
  field_values        JSONB         NOT NULL DEFAULT '{}'::jsonb,
  body                TEXT          NOT NULL DEFAULT '',
  linked_entity_type  TEXT          NULL,
  linked_entity_id    UUID          NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS articles_world_id_idx ON articles (world_id);
CREATE INDEX IF NOT EXISTS articles_folder_id_idx ON articles (folder_id);
DROP TRIGGER IF EXISTS trg_articles_updated_at ON articles;
CREATE TRIGGER trg_articles_updated_at BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3c. note_folders / notes
-- ============================================================
-- Campaign-scoped sibling of article_folders/articles - backs the Notes rail
-- section's "Folders" toggle (session-prep sheets, narrative/arc-planning
-- entries, and freeform notes organized into a file-explorer-style tree).
-- Two note_folders rows per campaign (Sessions/Narratives) are seeded lazily
-- by the frontend on first visit, not by this schema - is_default/
-- default_kind mark those two as protected from rename/delete (also
-- enforced server-side, see app/api/routers/notes.py).
CREATE TABLE IF NOT EXISTS note_folders (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id    UUID          NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
  parent_id      UUID          NULL REFERENCES note_folders (id) ON DELETE CASCADE,
  name           TEXT          NOT NULL,
  is_default     BOOLEAN       NOT NULL DEFAULT false,
  default_kind   TEXT          NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS note_folders_campaign_id_idx ON note_folders (campaign_id);
CREATE INDEX IF NOT EXISTS note_folders_parent_id_idx ON note_folders (parent_id);
DROP TRIGGER IF EXISTS trg_note_folders_updated_at ON note_folders;
CREATE TRIGGER trg_note_folders_updated_at BEFORE UPDATE ON note_folders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS notes (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id    UUID          NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
  folder_id      UUID          NULL REFERENCES note_folders (id) ON DELETE SET NULL,
  name           TEXT          NOT NULL,
  kind           TEXT          NULL,
  body           TEXT          NOT NULL DEFAULT '',
  tags           JSONB         NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_campaign_id_idx ON notes (campaign_id);
CREATE INDEX IF NOT EXISTS notes_folder_id_idx ON notes (folder_id);
DROP TRIGGER IF EXISTS trg_notes_updated_at ON notes;
CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3d. session_chats
-- ============================================================
-- Campaign-scoped, DM-only chat/scratch log for the Play page session runner
-- - a running log of quick notes the DM types while running a live session,
-- optionally tied to the session-prep Note it's paired with. Not player-
-- facing chat. messages is JSONB (array of {id, text, createdAt}), replaced
-- whole on write - same precedent as notes.tags above.
CREATE TABLE IF NOT EXISTS session_chats (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id    UUID          NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
  note_id        UUID          NULL REFERENCES notes (id) ON DELETE SET NULL,
  name           TEXT          NOT NULL,
  messages       JSONB         NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_chats_campaign_id_idx ON session_chats (campaign_id);
CREATE INDEX IF NOT EXISTS session_chats_note_id_idx ON session_chats (note_id);
DROP TRIGGER IF EXISTS trg_session_chats_updated_at ON session_chats;
CREATE TRIGGER trg_session_chats_updated_at BEFORE UPDATE ON session_chats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. raw_entities
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_entities (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source         TEXT          NOT NULL,
  source_file    TEXT          NOT NULL,
  source_key     TEXT          NOT NULL,
  entity_type    TEXT          NOT NULL,
  raw_data       JSONB         NOT NULL,
  content_hash   TEXT          NOT NULL,
  linked_table   TEXT          NULL,
  linked_id      UUID          NULL,
  import_status  TEXT          NOT NULL
    CHECK (import_status IN ('projected','raw_only','error')),
  imported_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (source_file, source_key)
);
CREATE INDEX IF NOT EXISTS raw_entities_entity_type_idx ON raw_entities (entity_type);
CREATE INDEX IF NOT EXISTS raw_entities_content_hash_idx ON raw_entities (content_hash);
CREATE INDEX IF NOT EXISTS raw_entities_linked_idx ON raw_entities (linked_table, linked_id);
CREATE INDEX IF NOT EXISTS raw_entities_raw_data_gin ON raw_entities USING gin (raw_data);
DROP TRIGGER IF EXISTS trg_raw_entities_updated_at ON raw_entities;
CREATE TRIGGER trg_raw_entities_updated_at BEFORE UPDATE ON raw_entities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. creatures
-- ============================================================
CREATE TABLE IF NOT EXISTS creatures (
  id                        UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id                 UUID        NULL REFERENCES sources (id),
  campaign_id                UUID        NULL REFERENCES campaigns (id),
  category                  TEXT        NOT NULL CHECK (category IN ('monster','npc')),
  name                      TEXT        NOT NULL,
  slug                      TEXT        NOT NULL,
  edition                   TEXT        NULL,
  creature_type             TEXT        NULL,
  creature_subtype          TEXT        NULL,
  size                      TEXT        NULL,
  alignment                 TEXT        NULL,
  challenge_rating          NUMERIC     NULL,
  challenge_rating_display  TEXT        NULL,
  proficiency_bonus         INTEGER     NULL,
  armor_class               INTEGER     NULL,
  hit_points                INTEGER     NULL,
  hit_dice                  TEXT        NULL,
  strength                  INTEGER     NULL,
  dexterity                 INTEGER     NULL,
  constitution              INTEGER     NULL,
  intelligence              INTEGER     NULL,
  wisdom                    INTEGER     NULL,
  charisma                  INTEGER     NULL,
  skills                    TEXT        NULL,
  senses                    TEXT        NULL,
  passive_perception        INTEGER     NULL,
  languages                 TEXT        NULL,
  traits                    TEXT        NULL,
  description               TEXT        NULL,
  relation                  TEXT        NULL CHECK (relation IS NULL OR relation IN ('ally','enemy','neutral','player')),
  importance                TEXT        NULL CHECK (importance IS NULL OR importance IN
                               ('boss','npc','side-character','recurring','important','quest-giver','minion','summon','monster')),
  profession                TEXT        NULL,
  level                     INTEGER     NULL,
  character_class           TEXT        NULL,
  motivations               TEXT        NULL,
  pitfalls                  TEXT        NULL,
  history                   TEXT        NULL,
  -- NPC-only, newline-joined itemized lists (same convention as motivations/pitfalls/traits
  -- above) - see random_appearances/random_secrets/random_relationships reference banks.
  appearance                TEXT        NULL,
  secrets                   TEXT        NULL,
  relationships             TEXT        NULL,
  portrait_asset_id         UUID        NULL REFERENCES assets (id),
  token_asset_id            UUID        NULL REFERENCES assets (id),
  -- NPC-only: which monster (if any) this NPC's stats were autofilled from, and whether the
  -- NPC form is in "custom" (manual class/level/etc) vs "creature" (picked from the monster
  -- catalog) mode. Only ever points at a category='monster' row (app-layer enforced).
  base_creature_id          UUID        NULL REFERENCES creatures (id),
  is_custom_build            BOOLEAN     NOT NULL DEFAULT true,
  default_size              NUMERIC     NOT NULL DEFAULT 1,
  current_size              NUMERIC     NOT NULL DEFAULT 1,
  is_favorite                BOOLEAN     NOT NULL DEFAULT false,
  raw_data                  JSONB       NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creatures_name_trgm_idx ON creatures USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS creatures_creature_type_idx ON creatures (creature_type);
CREATE INDEX IF NOT EXISTS creatures_challenge_rating_idx ON creatures (challenge_rating);
CREATE INDEX IF NOT EXISTS creatures_source_id_idx ON creatures (source_id);
CREATE INDEX IF NOT EXISTS creatures_campaign_id_idx ON creatures (campaign_id);
CREATE INDEX IF NOT EXISTS creatures_category_idx ON creatures (category);
CREATE INDEX IF NOT EXISTS creatures_base_creature_id_idx ON creatures (base_creature_id);
CREATE INDEX IF NOT EXISTS creatures_raw_data_gin ON creatures USING gin (raw_data);
CREATE UNIQUE INDEX IF NOT EXISTS creatures_slug_source_uidx ON creatures (slug, source_id) WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS creatures_slug_campaign_uidx ON creatures (slug, campaign_id) WHERE campaign_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_creatures_updated_at ON creatures;
CREATE TRIGGER trg_creatures_updated_at BEFORE UPDATE ON creatures
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 6. creature_actions
-- ============================================================
CREATE TABLE IF NOT EXISTS creature_actions (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creature_id      UUID        NOT NULL REFERENCES creatures (id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  action_type      TEXT        NOT NULL
    CHECK (action_type IN ('trait','action','bonus_action','reaction','legendary','mythic','lair','other')),
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  description      TEXT        NULL,
  attack_bonus     INTEGER     NULL,
  reach            INTEGER     NULL,
  range_normal     INTEGER     NULL,
  range_long       INTEGER     NULL,
  damage_formula   TEXT        NULL,
  damage_type      TEXT        NULL,
  save_ability     TEXT        NULL CHECK (save_ability IS NULL OR save_ability IN ('str','dex','con','int','wis','cha')),
  save_dc          INTEGER     NULL,
  recharge         TEXT        NULL,
  uses_text        TEXT        NULL,
  area             JSONB       NULL,
  mechanics        JSONB       NULL,
  raw_data         JSONB       NULL
);
CREATE INDEX IF NOT EXISTS creature_actions_creature_id_idx ON creature_actions (creature_id);
CREATE INDEX IF NOT EXISTS creature_actions_action_type_idx ON creature_actions (action_type);

-- ============================================================
-- 7. spells
-- ============================================================
CREATE TABLE IF NOT EXISTS spells (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id           UUID        NULL REFERENCES sources (id),
  campaign_id         UUID        NULL REFERENCES campaigns (id),
  name                TEXT        NOT NULL,
  slug                TEXT        NOT NULL,
  edition             TEXT        NULL,
  level               INTEGER     NOT NULL,
  school              TEXT        NULL,
  casting_time        TEXT        NULL,
  range               TEXT        NULL,
  duration            TEXT        NULL,
  concentration       BOOLEAN     NOT NULL DEFAULT false,
  ritual              BOOLEAN     NOT NULL DEFAULT false,
  components_display  TEXT        NULL,
  components          JSONB       NULL,
  classes_display     TEXT        NULL,
  classes             JSONB       NULL,
  description         TEXT        NULL,
  area                JSONB       NULL,
  damage              JSONB       NULL,
  saving_throw        JSONB       NULL,
  effects             JSONB       NULL,
  mechanics           JSONB       NULL,
  image_asset_id      UUID        NULL REFERENCES assets (id),
  raw_data            JSONB       NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spells_name_trgm_idx ON spells USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS spells_level_idx ON spells (level);
CREATE INDEX IF NOT EXISTS spells_school_idx ON spells (school);
CREATE INDEX IF NOT EXISTS spells_source_id_idx ON spells (source_id);
CREATE INDEX IF NOT EXISTS spells_campaign_id_idx ON spells (campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS spells_slug_source_uidx ON spells (slug, source_id) WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS spells_slug_campaign_uidx ON spells (slug, campaign_id) WHERE campaign_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_spells_updated_at ON spells;
CREATE TRIGGER trg_spells_updated_at BEFORE UPDATE ON spells
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 8. items
-- ============================================================
CREATE TABLE IF NOT EXISTS items (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id              UUID        NULL REFERENCES sources (id),
  campaign_id            UUID        NULL REFERENCES campaigns (id),
  name                   TEXT        NOT NULL,
  slug                   TEXT        NOT NULL,
  edition                TEXT        NULL,
  item_type              TEXT        NULL,
  rarity                 TEXT        NOT NULL
    CHECK (rarity IN ('common','uncommon','rare','very-rare','legendary','artifact','unknown','varies')),
  requires_attunement    BOOLEAN     NOT NULL DEFAULT false,
  attunement_requirement TEXT        NULL,
  weight                 NUMERIC     NULL,
  cost                   JSONB       NULL,
  description            TEXT        NULL,
  properties             JSONB       NULL,
  effects                JSONB       NULL,
  charges                JSONB       NULL,
  image_asset_id         UUID        NULL REFERENCES assets (id),
  raw_data               JSONB       NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS items_name_trgm_idx ON items USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS items_rarity_idx ON items (rarity);
CREATE INDEX IF NOT EXISTS items_item_type_idx ON items (item_type);
CREATE INDEX IF NOT EXISTS items_source_id_idx ON items (source_id);
CREATE INDEX IF NOT EXISTS items_campaign_id_idx ON items (campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS items_slug_source_uidx ON items (slug, source_id) WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS items_slug_campaign_uidx ON items (slug, campaign_id) WHERE campaign_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_items_updated_at ON items;
CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 9. conditions
-- ============================================================
CREATE TABLE IF NOT EXISTS conditions (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id      UUID        NULL REFERENCES sources (id),
  name           TEXT        NOT NULL,
  condition_type TEXT        NULL CHECK (condition_type IS NULL OR condition_type IN ('condition','disease','status')),
  description    TEXT        NULL,
  raw_data       JSONB       NULL,
  UNIQUE (name, source_id)
);
CREATE INDEX IF NOT EXISTS conditions_name_idx ON conditions (name);

-- ============================================================
-- 10. effects
-- ============================================================
CREATE TABLE IF NOT EXISTS effects (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id    UUID        NULL REFERENCES campaigns (id),
  name           TEXT        NOT NULL,
  effect_type    TEXT        NOT NULL DEFAULT 'CUSTOM'
    CHECK (effect_type IN ('DAMAGE','HEAL','CONDITION','REMOVE_CONDITION','MODIFIER','MOVEMENT','TELEPORT',
                            'SUMMON','BANISH','DISPEL','CREATE_AOE','DESTROY_AOE','GRANT_ADVANTAGE',
                            'GRANT_DISADVANTAGE','CUSTOM')),
  condition_id   UUID        NULL REFERENCES conditions (id),
  description    TEXT        NULL,
  icon           TEXT        NULL,
  mechanics      JSONB       NULL,
  raw_data       JSONB       NULL
);
CREATE INDEX IF NOT EXISTS effects_campaign_id_idx ON effects (campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS effects_name_global_uidx ON effects (name) WHERE campaign_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS effects_name_campaign_uidx ON effects (name, campaign_id) WHERE campaign_id IS NOT NULL;

-- ============================================================
-- 11. characters
-- ============================================================
CREATE TABLE IF NOT EXISTS characters (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id       UUID        NOT NULL REFERENCES campaigns (id),
  name              TEXT        NOT NULL,
  character_type    TEXT        NOT NULL DEFAULT 'pc' CHECK (character_type IN ('pc','companion','hireling','other')),
  level             INTEGER     NULL,
  class             TEXT        NULL,
  subclass          TEXT        NULL,
  species            TEXT        NULL,
  background         TEXT        NULL,
  current_hp         INTEGER     NULL,
  max_hp            INTEGER     NULL,
  temporary_hp       INTEGER     NOT NULL DEFAULT 0,
  armor_class        INTEGER     NULL,
  strength          INTEGER     NULL,
  dexterity         INTEGER     NULL,
  constitution       INTEGER     NULL,
  intelligence       INTEGER     NULL,
  wisdom            INTEGER     NULL,
  charisma          INTEGER     NULL,
  skills            JSONB       NULL,
  saving_throws      JSONB       NULL,
  resources          JSONB       NULL,
  equipment          JSONB       NULL,
  features           JSONB       NULL,
  notes             TEXT        NULL,
  portrait_asset_id  UUID        NULL REFERENCES assets (id),
  token_asset_id     UUID        NULL REFERENCES assets (id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS characters_campaign_id_idx ON characters (campaign_id);
DROP TRIGGER IF EXISTS trg_characters_updated_at ON characters;
CREATE TRIGGER trg_characters_updated_at BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 12. locations
-- (map_id -> maps.id FK added later - maps doesn't exist yet)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id                 UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id        UUID        NOT NULL REFERENCES campaigns (id),
  parent_location_id UUID        NULL REFERENCES locations (id),
  name               TEXT        NOT NULL,
  location_type      TEXT        NULL
    CHECK (location_type IS NULL OR location_type IN
           ('continent','country','region','city','district','building','room','dungeon','other')),
  description        TEXT        NULL,
  notes              TEXT        NULL,
  map_id             UUID        NULL,  -- FK -> maps.id added in section "deferred FKs" below
  image_asset_id      UUID        NULL REFERENCES assets (id),
  raw_data           JSONB       NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS locations_campaign_id_idx ON locations (campaign_id);
CREATE INDEX IF NOT EXISTS locations_parent_location_id_idx ON locations (parent_location_id);
DROP TRIGGER IF EXISTS trg_locations_updated_at ON locations;
CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 13. factions
-- ============================================================
CREATE TABLE IF NOT EXISTS factions (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id       UUID        NOT NULL REFERENCES campaigns (id),
  name              TEXT        NOT NULL,
  description       TEXT        NULL,
  faction_type      TEXT        NULL,
  goals             JSONB       NULL,
  beliefs           JSONB       NULL,
  resources         JSONB       NULL,
  locations         JSONB       NULL,
  members           JSONB       NULL,
  notes             TEXT        NULL,
  image_asset_id    UUID        NULL REFERENCES assets (id),
  -- Diplomacy graph fields: the Factions table is the single source of truth for
  -- both the table view and the Factions diplomacy graph.
  governance        TEXT        NULL,
  power             INTEGER     NOT NULL DEFAULT 1,
  power_label       TEXT        NULL,
  location_summary  TEXT        NULL,
  military          INTEGER     NOT NULL DEFAULT 30,
  naval             INTEGER     NOT NULL DEFAULT 30,
  economy           INTEGER     NOT NULL DEFAULT 30,
  reputation        INTEGER     NOT NULL DEFAULT 30,
  -- Node size in the diplomacy graph; 'petty' factions are excluded from the graph.
  influence         TEXT        NOT NULL DEFAULT 'regional'
    CHECK (influence IN ('petty','local','minor','regional','major')),
  raw_data          JSONB       NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS factions_campaign_id_idx ON factions (campaign_id);
DROP TRIGGER IF EXISTS trg_factions_updated_at ON factions;
CREATE TRIGGER trg_factions_updated_at BEFORE UPDATE ON factions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 13b. faction_relations
-- One row per unordered faction pair (faction_a_id < faction_b_id) - a relation
-- edited from either faction's side is the same row, so "A's relation to B" and
-- "B's relation to A" can never drift apart.
-- ============================================================
CREATE TABLE IF NOT EXISTS faction_relations (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id    UUID        NOT NULL REFERENCES campaigns (id),
  faction_a_id   UUID        NOT NULL REFERENCES factions (id) ON DELETE CASCADE,
  faction_b_id   UUID        NOT NULL REFERENCES factions (id) ON DELETE CASCADE,
  relation_type  TEXT        NOT NULL DEFAULT 'neutral'
    CHECK (relation_type IN ('ally','trade','peace','neutral','war','enemy')),
  strength       INTEGER     NOT NULL DEFAULT 40,
  -- Drives the diplomacy graph's radial position (primary = inner ring) and edge
  -- stroke-width tier (primary = thick); `strength` still varies weight within a tier.
  importance     TEXT        NOT NULL DEFAULT 'secondary'
    CHECK (importance IN ('primary','secondary')),
  treaties       JSONB       NULL,
  notes          TEXT        NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (faction_a_id < faction_b_id),
  UNIQUE (faction_a_id, faction_b_id)
);
CREATE INDEX IF NOT EXISTS faction_relations_campaign_id_idx ON faction_relations (campaign_id);
CREATE INDEX IF NOT EXISTS faction_relations_faction_b_id_idx ON faction_relations (faction_b_id);
DROP TRIGGER IF EXISTS trg_faction_relations_updated_at ON faction_relations;
CREATE TRIGGER trg_faction_relations_updated_at BEFORE UPDATE ON faction_relations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 14. quests
-- ============================================================
CREATE TABLE IF NOT EXISTS quests (
  id                       UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id              UUID        NOT NULL REFERENCES campaigns (id),
  name                     TEXT        NOT NULL,
  description              TEXT        NULL,
  status                   TEXT        NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','active','completed','failed','abandoned')),
  quest_giver_character_id UUID        NULL REFERENCES characters (id),
  quest_giver_creature_id  UUID        NULL REFERENCES creatures (id),
  related_faction_ids      JSONB       NULL,
  related_location_ids     JSONB       NULL,
  objectives               JSONB       NULL,
  rewards                  JSONB       NULL,
  notes                    TEXT        NULL,
  raw_data                 JSONB       NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quests_campaign_id_idx ON quests (campaign_id);
CREATE INDEX IF NOT EXISTS quests_status_idx ON quests (status);
DROP TRIGGER IF EXISTS trg_quests_updated_at ON quests;
CREATE TRIGGER trg_quests_updated_at BEFORE UPDATE ON quests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 14b. random_encounter_tables
-- DM-built grouping of existing encounters into a table the DM rolls a die
-- against to pick one. Distinct from encounters.tables/resolution_type, which
-- is importer-owned reference data for 5etools' own random-encounter tables.
-- ============================================================
CREATE TABLE IF NOT EXISTS random_encounter_tables (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id     UUID        NOT NULL REFERENCES campaigns (id),
  name            TEXT        NOT NULL,
  die_expression  TEXT        NOT NULL DEFAULT '1d8',
  entries         JSONB       NULL,  -- [{ "id": "...", "encounter_id": "..." }, ...], array order = table order
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS random_encounter_tables_campaign_id_idx ON random_encounter_tables (campaign_id);
DROP TRIGGER IF EXISTS trg_random_encounter_tables_updated_at ON random_encounter_tables;
CREATE TRIGGER trg_random_encounter_tables_updated_at BEFORE UPDATE ON random_encounter_tables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 15. maps
-- (primary_floor_id -> map_floors.id FK added later - map_floors
--  doesn't exist yet; location_id -> locations.id is fine now)
-- ============================================================
CREATE TABLE IF NOT EXISTS maps (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id         UUID        NOT NULL REFERENCES campaigns (id),
  location_id         UUID        NULL REFERENCES locations (id),
  name                TEXT        NOT NULL,
  description         TEXT        NULL,
  map_kinds           TEXT[]      NOT NULL DEFAULT '{}',
  map_location_text   TEXT        NULL,
  setting             TEXT        NULL CHECK (setting IS NULL OR setting IN ('indoor','outdoor','both')),
  activity            TEXT        NULL,
  grid_enabled        BOOLEAN     NOT NULL DEFAULT false,
  grid_size           INTEGER     NOT NULL DEFAULT 70,
  grid_color          TEXT        NOT NULL DEFAULT 'rgba(128,128,128,0.35)',
  grid_thickness      INTEGER     NOT NULL DEFAULT 1,
  grid_type           TEXT        NOT NULL DEFAULT 'square' CHECK (grid_type IN ('square','hex')),
  primary_floor_id    UUID        NULL,  -- FK -> map_floors.id added in "deferred FKs" section below
  settings            JSONB       NULL,
  raw_data            JSONB       NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maps_campaign_id_idx ON maps (campaign_id);
CREATE INDEX IF NOT EXISTS maps_location_id_idx ON maps (location_id);
DROP TRIGGER IF EXISTS trg_maps_updated_at ON maps;
CREATE TRIGGER trg_maps_updated_at BEFORE UPDATE ON maps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 16. map_floors
-- (locked_encounter_id -> encounters.id FK added later - encounters
--  doesn't exist yet)
-- ============================================================
CREATE TABLE IF NOT EXISTS map_floors (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_id              UUID        NOT NULL REFERENCES maps (id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  background_asset_id UUID        NOT NULL REFERENCES assets (id),
  width               INTEGER     NULL,
  height              INTEGER     NULL,
  flipped_horizontal  BOOLEAN     NOT NULL DEFAULT false,
  flipped_vertical    BOOLEAN     NOT NULL DEFAULT false,
  rotation            INTEGER     NOT NULL DEFAULT 0,
  locked_encounter_id UUID        NULL,  -- FK -> encounters.id added in "deferred FKs" section below
  walls               JSONB       NULL,
  doors               JSONB       NULL,
  lighting            JSONB       NULL,
  terrain             JSONB       NULL,
  raw_data            JSONB       NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS map_floors_map_id_idx ON map_floors (map_id);
DROP TRIGGER IF EXISTS trg_map_floors_updated_at ON map_floors;
CREATE TRIGGER trg_map_floors_updated_at BEFORE UPDATE ON map_floors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 19. token_library
-- (created before map_tokens, which references it)
-- ============================================================
CREATE TABLE IF NOT EXISTS token_library (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id    UUID        NULL REFERENCES campaigns (id),
  name           TEXT        NOT NULL,
  image_asset_id UUID        NOT NULL REFERENCES assets (id),
  is_favorite    BOOLEAN     NOT NULL DEFAULT false,
  default_size   NUMERIC     NOT NULL DEFAULT 1,
  current_size   NUMERIC     NOT NULL DEFAULT 1,
  raw_data       JSONB       NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS token_library_campaign_id_idx ON token_library (campaign_id);
DROP TRIGGER IF EXISTS trg_token_library_updated_at ON token_library;
CREATE TRIGGER trg_token_library_updated_at BEFORE UPDATE ON token_library
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 19b. category / tag / table_formats
-- (Random Tables + Encounters overhaul, Tasks 1-4: self-referential browse
--  tree, normalized namespaced tag vocabulary, and the roll-format lookup.
--  Declared before encounters since encounters.category_id references
--  category.)
-- ============================================================
CREATE TABLE IF NOT EXISTS category (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug         TEXT        NOT NULL UNIQUE,
  name         TEXT        NOT NULL,
  parent_id    UUID        NULL REFERENCES category (id) ON DELETE CASCADE,
  is_system    BOOLEAN     NOT NULL DEFAULT false,
  icon         TEXT        NULL,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS category_parent_id_idx ON category (parent_id);

CREATE TABLE IF NOT EXISTS tag (
  id         UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  namespace  TEXT    NOT NULL,
  value      TEXT    NOT NULL,
  label      TEXT    NOT NULL,
  is_system  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (namespace, value)
);
CREATE INDEX IF NOT EXISTS tag_namespace_idx ON tag (namespace);
CREATE INDEX IF NOT EXISTS tag_value_trgm_idx ON tag USING gin (value gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tag_label_trgm_idx ON tag USING gin (label gin_trgm_ops);

CREATE TABLE IF NOT EXISTS table_formats (
  id          UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  description TEXT    NULL,
  tier        TEXT    NOT NULL DEFAULT 'core' CHECK (tier IN ('core','advanced')),
  is_system   BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- 20. encounters
-- (created before map_floors.locked_encounter_id FK, which is added later.
--  Extended with the shared "run layer" fields from Task 7.3: primary_type/
--  category_id/status/read_aloud/objective/party assumptions/scaling_notes/
--  location_id/rewards. `notes` above continues to serve as dm_notes -
--  read_aloud is the new player-facing counterpart, kept as a separate
--  column per Task 7.3's explicit "kept SEPARATE from dm_notes".)
-- ============================================================
CREATE TABLE IF NOT EXISTS encounters (
  id                        UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id               UUID        NULL REFERENCES campaigns (id),
  map_id                    UUID        NULL REFERENCES maps (id),
  source_id                 UUID        NULL REFERENCES sources (id),
  page                      INTEGER     NULL,
  resolution_type           TEXT        NOT NULL DEFAULT 'fixed' CHECK (resolution_type IN ('fixed','random_table')),
  tables                    JSONB       NULL,
  name                      TEXT        NOT NULL,
  description               TEXT        NULL,
  challenge_rating_display  TEXT        NULL,
  computed_adjusted_xp      INTEGER     NULL,
  computed_cr               TEXT        NULL,
  difficulty                TEXT        NULL,
  theme                     TEXT        NULL,
  encounter_type            TEXT        NULL,
  possible_locations        TEXT[]      NULL,
  environment                TEXT        NULL,
  tags                      TEXT[]      NOT NULL DEFAULT '{}',
  starting_positions         JSONB       NULL,
  special_rules              JSONB       NULL,
  notes                      TEXT        NULL,
  raw_data                   JSONB       NULL,
  primary_type                TEXT        NULL CHECK (primary_type IS NULL OR primary_type IN ('combat','social','exploration')),
  category_id                  UUID        NULL REFERENCES category (id),
  status                       TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','used')),
  read_aloud                   TEXT        NULL,
  objective                    TEXT        NULL,
  party_level_min               INTEGER     NULL,
  party_level_max               INTEGER     NULL,
  party_size                    INTEGER     NULL,
  scaling_notes                 TEXT        NULL,
  location_id                   UUID        NULL REFERENCES locations (id),
  rewards                        JSONB       NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS encounters_campaign_id_idx ON encounters (campaign_id);
CREATE INDEX IF NOT EXISTS encounters_map_id_idx ON encounters (map_id);
CREATE INDEX IF NOT EXISTS encounters_source_id_idx ON encounters (source_id);
CREATE INDEX IF NOT EXISTS encounters_category_id_idx ON encounters (category_id);
CREATE INDEX IF NOT EXISTS encounters_location_id_idx ON encounters (location_id);
CREATE INDEX IF NOT EXISTS encounters_primary_type_idx ON encounters (primary_type);
CREATE UNIQUE INDEX IF NOT EXISTS encounters_name_source_uidx ON encounters (name, source_id) WHERE source_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_encounters_updated_at ON encounters;
CREATE TRIGGER trg_encounters_updated_at BEFORE UPDATE ON encounters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 21. encounter_creatures
-- (role/notes added for Task 8.1 - the combat roster row)
-- ============================================================
CREATE TABLE IF NOT EXISTS encounter_creatures (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  encounter_id          UUID        NOT NULL REFERENCES encounters (id) ON DELETE CASCADE,
  creature_id           UUID        NULL REFERENCES creatures (id),
  custom_name           TEXT        NULL,
  custom_image_asset_id UUID        NULL REFERENCES assets (id),
  quantity              INTEGER     NOT NULL DEFAULT 1,
  size_override         NUMERIC     NULL,
  sort_order            INTEGER     NOT NULL DEFAULT 0,
  role                  TEXT        NULL CHECK (role IS NULL OR role IN ('minion','skirmisher','brute','soldier','artillery','controller','lurker','leader','solo_boss','support_healer')),
  notes                 TEXT        NULL,
  raw_data              JSONB       NULL
);
CREATE INDEX IF NOT EXISTS encounter_creatures_encounter_id_idx ON encounter_creatures (encounter_id);
CREATE INDEX IF NOT EXISTS encounter_creatures_creature_id_idx ON encounter_creatures (creature_id);

-- ============================================================
-- 24. encounter_tables
-- (normalized random-encounter roll tables - one row per {min,max} range,
--  replacing encounters.tables/raw_data JSONB as the read path for display.
--  Populated by Database/EncounterProcessing.)
-- ============================================================
CREATE TABLE IF NOT EXISTS encounter_tables (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  encounter_id   UUID        NOT NULL REFERENCES encounters (id) ON DELETE CASCADE,
  dice_expression TEXT       NULL,
  min_level      INTEGER     NULL,
  max_level      INTEGER     NULL,
  min            INTEGER     NOT NULL,
  max            INTEGER     NOT NULL,
  result_text    TEXT        NULL,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS encounter_tables_encounter_id_idx ON encounter_tables (encounter_id);

-- ============================================================
-- 25. encounter_table_creatures
-- (creature references within one encounter_tables row, FK'd to creatures.id
--  instead of a free-text name inside JSON)
-- ============================================================
CREATE TABLE IF NOT EXISTS encounter_table_creatures (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  encounter_table_id  UUID        NOT NULL REFERENCES encounter_tables (id) ON DELETE CASCADE,
  creature_id         UUID        NULL REFERENCES creatures (id),
  creature_name_raw   TEXT        NOT NULL,
  quantity_formula    TEXT        NOT NULL DEFAULT '1',
  sort_order          INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS encounter_table_creatures_encounter_table_id_idx ON encounter_table_creatures (encounter_table_id);
CREATE INDEX IF NOT EXISTS encounter_table_creatures_creature_id_idx ON encounter_table_creatures (creature_id);

-- ============================================================
-- 25b. random_tables / table_columns / table_entries
-- (Tasks 1/5 - the new rollable-table core engine that supersedes
--  random_encounter_tables/situational_tables/encounter_tables+
--  encounter_table_creatures above; those tables are migrated into this
--  one and dropped in a later migration once the data-migration script
--  has run. category_id/format_id are the two of the three orthogonal
--  dimensions that are FKs; tags are the third, joined via
--  random_table_tag.)
-- ============================================================
CREATE TABLE IF NOT EXISTS random_tables (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id       UUID        NULL REFERENCES campaigns (id),
  name              TEXT        NOT NULL,
  description       TEXT        NULL,
  category_id       UUID        NULL REFERENCES category (id),
  format_id         UUID        NOT NULL REFERENCES table_formats (id),
  trigger_situation TEXT        NULL,
  image_url         TEXT        NULL,
  combine_template  TEXT        NULL,
  source_book       TEXT        NULL,
  format_config     JSONB       NULL,
  is_system         BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS random_tables_campaign_id_idx ON random_tables (campaign_id);
CREATE INDEX IF NOT EXISTS random_tables_category_id_idx ON random_tables (category_id);
CREATE INDEX IF NOT EXISTS random_tables_format_id_idx ON random_tables (format_id);
CREATE INDEX IF NOT EXISTS random_tables_name_trgm_idx ON random_tables USING gin (name gin_trgm_ops);
-- Idempotency key for the table/table_group importer projector (Database/Maintainance/
-- importer/projectors/table.py), same pattern as encounters_name_source_uidx above.
CREATE UNIQUE INDEX IF NOT EXISTS random_tables_name_source_book_uidx ON random_tables (name, source_book) WHERE source_book IS NOT NULL;
DROP TRIGGER IF EXISTS trg_random_tables_updated_at ON random_tables;
CREATE TRIGGER trg_random_tables_updated_at BEFORE UPDATE ON random_tables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS random_table_tag (
  table_id UUID NOT NULL REFERENCES random_tables (id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES tag (id) ON DELETE CASCADE,
  PRIMARY KEY (table_id, tag_id)
);
CREATE INDEX IF NOT EXISTS random_table_tag_tag_id_idx ON random_table_tag (tag_id);

CREATE TABLE IF NOT EXISTS encounter_tag (
  encounter_id UUID NOT NULL REFERENCES encounters (id) ON DELETE CASCADE,
  tag_id       UUID NOT NULL REFERENCES tag (id) ON DELETE CASCADE,
  PRIMARY KEY (encounter_id, tag_id)
);
CREATE INDEX IF NOT EXISTS encounter_tag_tag_id_idx ON encounter_tag (tag_id);

-- table_entry_tag is declared after table_entries below (needs that table to exist).

CREATE TABLE IF NOT EXISTS table_columns (
  id            UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id      UUID    NOT NULL REFERENCES random_tables (id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  die_count     INTEGER NOT NULL DEFAULT 1,
  die_sides     INTEGER NOT NULL DEFAULT 20,
  die_modifier  INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS table_columns_table_id_idx ON table_columns (table_id);

CREATE TABLE IF NOT EXISTS table_entries (
  id               UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id        UUID    NOT NULL REFERENCES table_columns (id) ON DELETE CASCADE,
  min              INTEGER NULL,
  max              INTEGER NULL,
  secondary_min    INTEGER NULL,
  secondary_max    INTEGER NULL,
  weight           INTEGER NULL,
  kind             TEXT    NOT NULL DEFAULT 'text' CHECK (kind IN ('text','encounter_ref','table_ref','creature_ref','npc_ref','item_ref')),
  text             TEXT    NULL,
  encounter_id     UUID    NULL REFERENCES encounters (id),
  target_table_id  UUID    NULL REFERENCES random_tables (id),
  creature_id      UUID    NULL REFERENCES creatures (id),
  npc_id           UUID    NULL REFERENCES creatures (id),
  item_id          UUID    NULL REFERENCES items (id),
  bundle           JSONB   NULL,
  notes            TEXT    NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS table_entries_column_id_idx ON table_entries (column_id);
CREATE INDEX IF NOT EXISTS table_entries_encounter_id_idx ON table_entries (encounter_id);
CREATE INDEX IF NOT EXISTS table_entries_target_table_id_idx ON table_entries (target_table_id);

CREATE TABLE IF NOT EXISTS table_entry_tag (
  entry_id UUID NOT NULL REFERENCES table_entries (id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES tag (id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);
CREATE INDEX IF NOT EXISTS table_entry_tag_tag_id_idx ON table_entry_tag (tag_id);

-- ============================================================
-- 25c. generators / generator_components
-- (Task 6 - composite generators combining several random_tables into
--  named, optionally tag-filtered output slots.)
-- ============================================================
CREATE TABLE IF NOT EXISTS generators (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id      UUID        NULL REFERENCES campaigns (id),
  slug             TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  category_id      UUID        NULL REFERENCES category (id),
  description      TEXT        NULL,
  combine_template TEXT        NOT NULL,
  parameters       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  is_system        BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS generators_campaign_id_idx ON generators (campaign_id);
CREATE INDEX IF NOT EXISTS generators_category_id_idx ON generators (category_id);
DROP TRIGGER IF EXISTS trg_generators_updated_at ON generators;
CREATE TRIGGER trg_generators_updated_at BEFORE UPDATE ON generators
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS generator_components (
  id                UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generator_id      UUID    NOT NULL REFERENCES generators (id) ON DELETE CASCADE,
  table_id          UUID    NOT NULL REFERENCES random_tables (id),
  output_slot       TEXT    NOT NULL,
  filter_param_key  TEXT    NULL,
  roll_count        INTEGER NOT NULL DEFAULT 1,
  optional          BOOLEAN NOT NULL DEFAULT false,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (generator_id, output_slot)
);
CREATE INDEX IF NOT EXISTS generator_components_generator_id_idx ON generator_components (generator_id);

CREATE TABLE IF NOT EXISTS generator_tag (
  generator_id UUID NOT NULL REFERENCES generators (id) ON DELETE CASCADE,
  tag_id       UUID NOT NULL REFERENCES tag (id) ON DELETE CASCADE,
  PRIMARY KEY (generator_id, tag_id)
);

-- ============================================================
-- 25d. encounter_combat_blocks / encounter_social_blocks /
--      encounter_npcs / encounter_exploration_blocks
-- (Tasks 8-10 - optional 1:1 pillar detail blocks. An encounter can carry
--  more than one at once, e.g. a parley (social) that can escalate into a
--  fight (combat) - see each block's `escalation`/`complications` fields.)
-- ============================================================
CREATE TABLE IF NOT EXISTS encounter_combat_blocks (
  encounter_id          UUID    NOT NULL PRIMARY KEY REFERENCES encounters (id) ON DELETE CASCADE,
  shape                 TEXT    NULL CHECK (shape IS NULL OR shape IN ('ambush','skirmish','set_piece_boss','horde_swarm','waves_gauntlet','duel','siege','chase','escort_defense','puzzle_combat')),
  victory_condition     TEXT    NULL CHECK (victory_condition IS NULL OR victory_condition IN ('defeat_all','defeat_leader','survive_rounds','protect_escort','reach_escape','retrieve_destroy','capture_alive','hold_position','slip_past','break_morale')),
  awareness             TEXT    NULL CHECK (awareness IS NULL OR awareness IN ('party_surprised','enemies_surprised','mutual','stealth_approach')),
  start_range           TEXT    NULL CHECK (start_range IS NULL OR start_range IN ('melee','close','medium','long','variable')),
  lighting              TEXT    NULL CHECK (lighting IS NULL OR lighting IN ('bright','dim','darkness','magical_darkness')),
  terrain_type          TEXT    NULL CHECK (terrain_type IS NULL OR terrain_type IN ('open','dense_forest','corridor_cramped','cavern','rooftops_urban','bridge_chokepoint','water_swamp','vertical_cliffs','ruins_rubble','interior_room')),
  terrain_features      JSONB   NOT NULL DEFAULT '[]'::jsonb,
  morale                TEXT    NULL CHECK (morale IS NULL OR morale IN ('fights_to_death','flees_50pct','flees_leader_falls','surrenders_losing','parleys','retreats_reinforce','fanatical')),
  reinforcements        JSONB   NULL,
  dynamic_events        JSONB   NOT NULL DEFAULT '[]'::jsonb,
  difficulty_band       TEXT    NULL CHECK (difficulty_band IS NULL OR difficulty_band IN ('low','moderate','high','easy','medium','hard','deadly')),
  computed_xp           INTEGER NULL,
  has_lair_or_legendary BOOLEAN NOT NULL DEFAULT false,
  aftermath             JSONB   NOT NULL DEFAULT '[]'::jsonb,
  scaling_notes         TEXT    NULL,
  map_id                UUID    NULL REFERENCES maps (id),
  transition_encounter_id UUID NULL REFERENCES encounters (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS encounter_social_blocks (
  encounter_id   UUID  NOT NULL PRIMARY KEY REFERENCES encounters (id) ON DELETE CASCADE,
  shape          TEXT  NULL CHECK (shape IS NULL OR shape IN ('negotiation','interrogation','request_persuasion','deception_infiltration','intimidation','haggle_bargain','court_audience','trial','info_gathering','recruitment','calming_hostility','debate','performance','verbal_puzzle')),
  venue          TEXT  NULL CHECK (venue IS NULL OR venue IN ('tavern','court_throne_room','street_market','prison','temple','guild_hall','camp','private_residence','battlefield_parley','shop')),
  tone           TEXT  NULL CHECK (tone IS NULL OR tone IN ('tense','cordial','formal','comedic','threatening','somber','mysterious')),
  stakes         TEXT  NULL CHECK (stakes IS NULL OR stakes IN ('information','ally_introduction','item_reward','safe_passage','job_quest','a_life','contract_deal','access','nothing')),
  player_levers  JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_checks     JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome_tiers  JSONB NULL,
  social_clock   JSONB NULL,
  gated_info     JSONB NOT NULL DEFAULT '[]'::jsonb,
  complications  JSONB NOT NULL DEFAULT '[]'::jsonb,
  escalation     TEXT  NULL CHECK (escalation IS NULL OR escalation IN ('can_turn_combat','can_turn_chase','locks_out_if_failed','alerts_others')),
  transition_encounter_id UUID NULL REFERENCES encounters (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS encounter_npcs (
  id           UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  encounter_id UUID    NOT NULL REFERENCES encounters (id) ON DELETE CASCADE,
  npc_id       UUID    NOT NULL REFERENCES creatures (id),
  attitude     TEXT    NULL CHECK (attitude IS NULL OR attitude IN ('hostile','unfriendly','indifferent','friendly','helpful')),
  agenda       TEXT    NULL CHECK (agenda IS NULL OR agenda IN ('wants_money','wants_protection','wants_information','wants_revenge','wants_recruit','wants_deceive','wants_escape','wants_status','hiding_secret','testing_party')),
  secret       TEXT    NULL,
  leverage     TEXT    NULL,
  rp_cues      JSONB   NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS encounter_npcs_encounter_id_idx ON encounter_npcs (encounter_id);
CREATE INDEX IF NOT EXISTS encounter_npcs_npc_id_idx ON encounter_npcs (npc_id);

CREATE TABLE IF NOT EXISTS encounter_exploration_blocks (
  encounter_id        UUID    NOT NULL PRIMARY KEY REFERENCES encounters (id) ON DELETE CASCADE,
  shape                TEXT    NULL CHECK (shape IS NULL OR shape IN ('navigation_travel','dungeon_delve','trap','hazard','puzzle','investigation_discovery','survival','traversal','timed_escape','skill_challenge','environmental_set_piece','stealth_infiltration')),
  environment          TEXT    NULL CHECK (environment IS NULL OR environment IN ('forest','mountain','desert','swamp','arctic','coast','sea','underdark','urban','dungeon','ruins','jungle','grassland','feywild','shadowfell','planar')),
  terrain_difficulty   TEXT    NULL CHECK (terrain_difficulty IS NULL OR terrain_difficulty IN ('normal','difficult','hazardous','impassable')),
  obstacle_type        TEXT    NULL CHECK (obstacle_type IS NULL OR obstacle_type IN ('physical_barrier','trap','environmental_hazard','locked_sealed','puzzle_mechanism','guardian','natural_feature','maze_navigation')),
  trap                 JSONB   NULL,
  hazard               JSONB   NULL,
  skill_challenge      JSONB   NULL,
  puzzle               JSONB   NULL,
  sensory_clues        JSONB   NOT NULL DEFAULT '[]'::jsonb,
  points_of_interest   JSONB   NOT NULL DEFAULT '[]'::jsonb,
  navigation           JSONB   NULL,
  resource_cost        JSONB   NOT NULL DEFAULT '[]'::jsonb,
  verticality          BOOLEAN NOT NULL DEFAULT false,
  complications        JSONB   NOT NULL DEFAULT '[]'::jsonb,
  transition_encounter_id UUID NULL REFERENCES encounters (id) ON DELETE SET NULL,
  wandering_table_id   UUID NULL REFERENCES random_tables (id) ON DELETE SET NULL
);

-- ============================================================
-- 17. map_tokens
-- (needs map_floors, token_library, creatures, characters, encounter_creatures, assets - all exist now)
-- ============================================================
CREATE TABLE IF NOT EXISTS map_tokens (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_floor_id          UUID        NOT NULL REFERENCES map_floors (id) ON DELETE CASCADE,
  token_definition_id   UUID        NULL REFERENCES token_library (id),
  creature_id           UUID        NULL REFERENCES creatures (id),
  character_id          UUID        NULL REFERENCES characters (id),
  encounter_creature_id UUID        NULL REFERENCES encounter_creatures (id),
  name                  TEXT        NOT NULL,
  image_asset_id        UUID        NULL REFERENCES assets (id),
  x                     NUMERIC     NOT NULL,
  y                     NUMERIC     NOT NULL,
  size                  NUMERIC     NOT NULL,
  outline_color         TEXT        NOT NULL DEFAULT '#f5c542',
  current_hp            INTEGER     NULL,
  max_hp                INTEGER     NULL,
  concentrating         BOOLEAN     NOT NULL DEFAULT false,
  death_save_successes  INTEGER     NOT NULL DEFAULT 0,
  death_save_failures   INTEGER     NOT NULL DEFAULT 0,
  effects               JSONB       NOT NULL DEFAULT '[]',
  notes                 TEXT        NULL,
  raw_data              JSONB       NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS map_tokens_map_floor_id_idx ON map_tokens (map_floor_id);
CREATE INDEX IF NOT EXISTS map_tokens_creature_id_idx ON map_tokens (creature_id);
CREATE INDEX IF NOT EXISTS map_tokens_character_id_idx ON map_tokens (character_id);
CREATE INDEX IF NOT EXISTS map_tokens_encounter_creature_id_idx ON map_tokens (encounter_creature_id);
DROP TRIGGER IF EXISTS trg_map_tokens_updated_at ON map_tokens;
CREATE TRIGGER trg_map_tokens_updated_at BEFORE UPDATE ON map_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 18. map_shapes
-- ============================================================
CREATE TABLE IF NOT EXISTS map_shapes (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_floor_id  UUID        NOT NULL REFERENCES map_floors (id) ON DELETE CASCADE,
  shape_type    TEXT        NOT NULL
    CHECK (shape_type IN ('circle','cone','square','rectangle','line','thin-line','freehand')),
  x             NUMERIC     NOT NULL,
  y             NUMERIC     NOT NULL,
  radius        NUMERIC     NULL,
  rotation      NUMERIC     NOT NULL DEFAULT 0,
  width         NUMERIC     NULL,
  height        NUMERIC     NULL,
  points        JSONB       NULL,
  color         TEXT        NOT NULL,
  stroke_width  NUMERIC     NULL,
  raw_data      JSONB       NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS map_shapes_map_floor_id_idx ON map_shapes (map_floor_id);

-- ============================================================
-- 22. combats
-- ============================================================
CREATE TABLE IF NOT EXISTS combats (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  encounter_id  UUID        NULL REFERENCES encounters (id),
  campaign_id   UUID        NOT NULL REFERENCES campaigns (id),
  map_floor_id  UUID        NULL REFERENCES map_floors (id),
  name          TEXT        NULL,
  round         INTEGER     NOT NULL DEFAULT 1,
  current_turn  INTEGER     NULL,
  status        TEXT        NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','rolling','active','completed')),
  events        JSONB       NULL,
  started_at    TIMESTAMPTZ NULL,
  ended_at      TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS combats_encounter_id_idx ON combats (encounter_id);
CREATE INDEX IF NOT EXISTS combats_campaign_id_idx ON combats (campaign_id);
CREATE INDEX IF NOT EXISTS combats_map_floor_id_idx ON combats (map_floor_id);
CREATE INDEX IF NOT EXISTS combats_status_idx ON combats (status);
DROP TRIGGER IF EXISTS trg_combats_updated_at ON combats;
CREATE TRIGGER trg_combats_updated_at BEFORE UPDATE ON combats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 23. combatants
-- ============================================================
CREATE TABLE IF NOT EXISTS combatants (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  combat_id              UUID        NOT NULL REFERENCES combats (id) ON DELETE CASCADE,
  map_token_id           UUID        NULL REFERENCES map_tokens (id),
  creature_id            UUID        NULL REFERENCES creatures (id),
  character_id           UUID        NULL REFERENCES characters (id),
  display_name           TEXT        NOT NULL,
  current_hp             INTEGER     NULL,
  temporary_hp           INTEGER     NOT NULL DEFAULT 0,
  max_hp                 INTEGER     NULL,
  initiative_base_roll   INTEGER     NULL,
  initiative_modifier    INTEGER     NOT NULL DEFAULT 0,
  initiative             INTEGER     NULL,
  initiative_order       INTEGER     NULL,
  initiative_locked      BOOLEAN     NOT NULL DEFAULT false,
  is_current_turn        BOOLEAN     NOT NULL DEFAULT false,
  x                      NUMERIC     NULL,
  y                      NUMERIC     NULL,
  z                      NUMERIC     NULL,
  movement_used          NUMERIC     NOT NULL DEFAULT 0,
  conditions             JSONB       NOT NULL DEFAULT '[]',
  effects                JSONB       NOT NULL DEFAULT '[]',
  resources              JSONB       NULL,
  concentration          JSONB       NULL,
  death_save_successes   INTEGER     NOT NULL DEFAULT 0,
  death_save_failures    INTEGER     NOT NULL DEFAULT 0,
  action_used            BOOLEAN     NOT NULL DEFAULT false,
  bonus_action_used      BOOLEAN     NOT NULL DEFAULT false,
  reaction_used          BOOLEAN     NOT NULL DEFAULT false,
  visibility             JSONB       NULL,
  status                 TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','down','dead','fled','removed')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS combatants_combat_id_idx ON combatants (combat_id);
CREATE INDEX IF NOT EXISTS combatants_creature_id_idx ON combatants (creature_id);
CREATE INDEX IF NOT EXISTS combatants_character_id_idx ON combatants (character_id);
CREATE INDEX IF NOT EXISTS combatants_map_token_id_idx ON combatants (map_token_id);
DROP TRIGGER IF EXISTS trg_combatants_updated_at ON combatants;
CREATE TRIGGER trg_combatants_updated_at BEFORE UPDATE ON combatants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 26. bastion_facilities
-- (reference catalog, importer-owned like spells/items - the D&D 2024
--  Bastion system's facility list, e.g. "Garden", "Armory")
-- ============================================================
CREATE TABLE IF NOT EXISTS bastion_facilities (
  id                 UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id          UUID        NULL REFERENCES sources (id),
  name               TEXT        NOT NULL,
  slug               TEXT        NOT NULL,
  facility_type      TEXT        NOT NULL DEFAULT 'basic' CHECK (facility_type IN ('basic','special')),
  space              JSONB       NULL,
  prerequisite_level INTEGER     NULL,
  hirelings          JSONB       NULL,
  orders             JSONB       NULL,
  description        TEXT        NULL,
  image_asset_id     UUID        NULL REFERENCES assets (id),
  page               INTEGER     NULL,
  raw_data           JSONB       NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS bastion_facilities_slug_source_uidx ON bastion_facilities (slug, source_id) WHERE source_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_bastion_facilities_updated_at ON bastion_facilities;
CREATE TRIGGER trg_bastion_facilities_updated_at BEFORE UPDATE ON bastion_facilities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 27. bastions
-- (per-campaign tracker: one row per PC's stronghold)
-- ============================================================
CREATE TABLE IF NOT EXISTS bastions (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id  UUID        NOT NULL REFERENCES campaigns (id),
  character_id UUID        NULL REFERENCES characters (id),
  name         TEXT        NOT NULL,
  notes        TEXT        NULL,
  treasury     INTEGER     NOT NULL DEFAULT 0,
  raw_data     JSONB       NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bastions_campaign_id_idx ON bastions (campaign_id);
CREATE INDEX IF NOT EXISTS bastions_character_id_idx ON bastions (character_id);
DROP TRIGGER IF EXISTS trg_bastions_updated_at ON bastions;
CREATE TRIGGER trg_bastions_updated_at BEFORE UPDATE ON bastions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 28. bastion_facility_instances
-- (join: one row per facility a PC's bastion has actually built)
-- ============================================================
CREATE TABLE IF NOT EXISTS bastion_facility_instances (
  id                 UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bastion_id         UUID        NOT NULL REFERENCES bastions (id) ON DELETE CASCADE,
  facility_id        UUID        NULL REFERENCES bastion_facilities (id),
  custom_name        TEXT        NULL,
  status             TEXT        NOT NULL DEFAULT 'built' CHECK (status IN ('under_construction','built','decommissioned')),
  defenders_assigned INTEGER     NOT NULL DEFAULT 0,
  pending_order      JSONB       NULL,
  notes              TEXT        NULL,
  sort_order         INTEGER     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bastion_facility_instances_bastion_id_idx ON bastion_facility_instances (bastion_id);
CREATE INDEX IF NOT EXISTS bastion_facility_instances_facility_id_idx ON bastion_facility_instances (facility_id);
DROP TRIGGER IF EXISTS trg_bastion_facility_instances_updated_at ON bastion_facility_instances;
CREATE TRIGGER trg_bastion_facility_instances_updated_at BEFORE UPDATE ON bastion_facility_instances
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- NPC randomizer reference banks
-- Global reference data (no campaign_id), same shape convention as `conditions` above -
-- these are DM-tool-wide banks the NPC randomizer picks from client-side, not per-campaign
-- data. random_names.raw_data carries {race, option, source} provenance from the 5etools
-- import for traceability only.
-- ============================================================
CREATE TABLE IF NOT EXISTS random_names (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL,
  name_type  TEXT        NOT NULL CHECK (name_type IN ('first','last')),
  raw_data   JSONB       NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, name_type)
);
CREATE INDEX IF NOT EXISTS random_names_name_type_idx ON random_names (name_type);

CREATE TABLE IF NOT EXISTS random_professions (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL UNIQUE,
  raw_data   JSONB       NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_motivations (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_pitfalls (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NPC "Personality" itemized field reuses creatures.traits (no bank table needed beyond
-- this one); appearance/secrets/relationships below back the matching creatures columns.
CREATE TABLE IF NOT EXISTS random_appearances (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_secrets (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_personalities (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_relationships (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Places randomizer reference banks (World Manager Places tab: Countries/Settlements/
-- Buildings/Dungeons) - same flat text-list shape as the NPC banks above, no uniqueness
-- constraint, seeded once via Database/Maintainance/scripts/seed_places_random_banks.py.
-- ============================================================
CREATE TABLE IF NOT EXISTS random_dungeon_states_of_ruin (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_dungeon_quirks (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_shop_types (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_tavern_name_parts (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  part_type  TEXT        NOT NULL CHECK (part_type IN ('first','second')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS random_tavern_name_parts_part_type_idx ON random_tavern_name_parts (part_type);

CREATE TABLE IF NOT EXISTS random_settlement_defining_traits (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_settlement_claims_to_fame (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_settlement_calamities (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_settlement_local_leaders (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_settlement_economic_sources (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS random_settlement_rumors_hooks (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 29. situational_tables
-- ============================================================
-- Curated, hand-authored non-combat roleplay/exploration random tables for
-- the Encounters section's "Roleplay & Exploration" tab (e.g. a themed
-- "Darkwood Forest" table with linked encounter/behavior/complication
-- columns, each independently rolled and combined into a scene prompt).
-- Read-only reference content seeded by
-- Database/Maintainance/scripts/seed_situational_tables.py, same precedent
-- as the flat random_* bank tables above - no write endpoints, no FK to
-- anything. `columns` is JSONB (array of {key,label,dieSize,entries:
-- [{roll,text}]}) rather than normalized join tables since this is
-- hand-authored content that only needs to render, not be queried
-- relationally.
CREATE TABLE IF NOT EXISTS situational_tables (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT          NOT NULL,
  theme          TEXT          NOT NULL,
  tags           JSONB         NOT NULL DEFAULT '[]'::jsonb,
  description    TEXT          NOT NULL DEFAULT '',
  source         TEXT          NOT NULL DEFAULT '',
  columns        JSONB         NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS situational_tables_theme_idx ON situational_tables (theme);
DROP TRIGGER IF EXISTS trg_situational_tables_updated_at ON situational_tables;
CREATE TRIGGER trg_situational_tables_updated_at BEFORE UPDATE ON situational_tables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Deferred FKs (mutual references resolved after all tables exist)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locations_map_id_fkey'
  ) THEN
    ALTER TABLE locations
      ADD CONSTRAINT locations_map_id_fkey FOREIGN KEY (map_id) REFERENCES maps (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'maps_primary_floor_id_fkey'
  ) THEN
    ALTER TABLE maps
      ADD CONSTRAINT maps_primary_floor_id_fkey FOREIGN KEY (primary_floor_id) REFERENCES map_floors (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'map_floors_locked_encounter_id_fkey'
  ) THEN
    ALTER TABLE map_floors
      ADD CONSTRAINT map_floors_locked_encounter_id_fkey FOREIGN KEY (locked_encounter_id) REFERENCES encounters (id);
  END IF;
END $$;

COMMIT;
