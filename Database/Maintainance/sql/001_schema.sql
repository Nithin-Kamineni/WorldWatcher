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
                           'character_token','bastion_facility_image','other')),
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
-- 3. campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT          NOT NULL,
  description    TEXT          NULL,
  image_asset_id UUID          NULL REFERENCES assets (id),
  ruleset        TEXT          NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON campaigns;
CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON campaigns
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
  portrait_asset_id         UUID        NULL REFERENCES assets (id),
  token_asset_id            UUID        NULL REFERENCES assets (id),
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
-- 20. encounters
-- (created before map_floors.locked_encounter_id FK, which is added later)
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
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS encounters_campaign_id_idx ON encounters (campaign_id);
CREATE INDEX IF NOT EXISTS encounters_map_id_idx ON encounters (map_id);
CREATE INDEX IF NOT EXISTS encounters_source_id_idx ON encounters (source_id);
CREATE UNIQUE INDEX IF NOT EXISTS encounters_name_source_uidx ON encounters (name, source_id) WHERE source_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_encounters_updated_at ON encounters;
CREATE TRIGGER trg_encounters_updated_at BEFORE UPDATE ON encounters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 21. encounter_creatures
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
