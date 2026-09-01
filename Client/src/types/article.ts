export type ArticleFieldType = 'text' | 'textarea' | 'number' | 'select' | 'itemlist';

/** Which randomizer reference bank an 'itemlist' field's dice button draws from -
 * useArticleRandomBankStore.ts fetches all of these and exposes a pickRandomFromBank(key)
 * helper, the itemized counterpart to useRandomizerBankStore's NPC-field pickers. */
export type ArticleRandomBankKey =
  | 'dungeonStatesOfRuin'
  | 'dungeonQuirks'
  | 'shopTypes'
  | 'settlementDefiningTraits'
  | 'settlementClaimsToFame'
  | 'settlementCalamities'
  | 'settlementLocalLeaders'
  | 'settlementEconomicSources'
  | 'settlementRumorsHooks';

export interface ArticleFieldDef {
  key: string;
  label: string;
  type: ArticleFieldType;
  placeholder?: string;
  options?: string[];
  /** 'itemlist' fields only - which bank ItemListField's dice button pulls from. */
  bankKey?: ArticleRandomBankKey;
  /** Render this field only when another field on the same article currently equals a given
   * value - e.g. Building's "Shop type" only makes sense when Type = "Shop". */
  showWhen?: { field: string; equals: string };
  /** Suppress this field entirely when the article is linked to one of these entity types -
   * e.g. Character's "Race / Species" duplicates the linked NPC's own Combat card, so it's
   * hidden rather than asked twice. See getVisibleSections. */
  hideWhenLinkedTo?: ArticleLinkedEntityType[];
}

export interface ArticleSectionDef {
  label: string;
  fields: ArticleFieldDef[];
}

export type ArticleGroup = 'People' | 'Places' | 'Powers & Things' | 'Story';

export type ArticleCategory =
  | 'character'
  | 'deity'
  | 'settlement'
  | 'geography'
  | 'building'
  | 'country'
  | 'dungeon'
  | 'faction'
  | 'item'
  | 'spell'
  | 'plot'
  | 'event';

export interface ArticleTemplate {
  category: ArticleCategory;
  label: string;
  group: ArticleGroup;
  /** Icon key resolved to a MUI icon component by ArticleTypePicker/ArticleCard - kept as a
   * plain string here so this file stays pure data (no JSX), same reasoning as every other
   * types/*.ts file in this codebase. */
  icon: string;
  sections: ArticleSectionDef[];
}

/** A representative slice of World Anvil-style article categories (not all ~20 from the
 * reference screenshot) - each hand-tuned like FactionFormDialog's layout, just declared as
 * data so ArticleForm can render every category from one generic component instead of one
 * bespoke dialog per type. Adding a new category later is a new entry here, not new code. */
export const ARTICLE_TEMPLATES: Record<ArticleCategory, ArticleTemplate> = {
  character: {
    category: 'character',
    label: 'Character',
    group: 'People',
    icon: 'Person',
    sections: [
      {
        label: 'Overview',
        fields: [
          { key: 'titleOrAliases', label: 'Title / Aliases', type: 'text', placeholder: 'The Blacksmith of Silverport' },
          { key: 'raceSpecies', label: 'Race / Species', type: 'text', placeholder: 'Human, Elf, Dragonborn…', hideWhenLinkedTo: ['npc'] },
          { key: 'age', label: 'Age', type: 'text', placeholder: '34' },
          { key: 'occupation', label: 'Occupation', type: 'text', placeholder: 'Blacksmith, Spymaster, Innkeeper…', hideWhenLinkedTo: ['npc'] },
          { key: 'alignment', label: 'Alignment', type: 'text', placeholder: 'Lawful Good', hideWhenLinkedTo: ['npc'] },
        ],
      },
      {
        label: 'Affiliation',
        fields: [
          { key: 'affiliation', label: 'Faction / Affiliation', type: 'text', placeholder: 'Silver Hand' },
          { key: 'location', label: 'Location', type: 'text', placeholder: 'Silverport' },
        ],
      },
      {
        label: 'Appearance & personality',
        fields: [
          {
            key: 'appearance',
            label: 'Appearance',
            type: 'textarea',
            placeholder: 'Tall, soot-stained apron, a burn scar down one forearm…',
            hideWhenLinkedTo: ['npc'],
          },
          {
            key: 'personality',
            label: 'Personality',
            type: 'textarea',
            placeholder: 'Gruff but fair, distrusts nobles…',
            hideWhenLinkedTo: ['npc'],
          },
        ],
      },
      {
        label: 'Background',
        fields: [
          {
            key: 'backstory',
            label: 'Backstory',
            type: 'textarea',
            placeholder: 'Where they came from, what shaped them…',
            hideWhenLinkedTo: ['npc'],
          },
        ],
      },
    ],
  },

  deity: {
    category: 'deity',
    label: 'Deity',
    group: 'People',
    icon: 'AutoAwesome',
    sections: [
      {
        label: 'Overview',
        fields: [
          { key: 'titles', label: 'Title(s)', type: 'text', placeholder: 'The Ever-Watchful, Lady of Tides' },
          { key: 'domains', label: 'Domain(s) / Portfolio', type: 'text', placeholder: 'Tempest, Nature' },
          { key: 'alignment', label: 'Alignment', type: 'text', placeholder: 'Chaotic Neutral' },
          { key: 'symbol', label: 'Symbol', type: 'text', placeholder: 'A silver wave over a crescent moon' },
        ],
      },
      {
        label: 'Worship',
        fields: [
          { key: 'worshippers', label: 'Worshippers', type: 'text', placeholder: 'Sailors, fisherfolk, coastal towns' },
          { key: 'homePlane', label: 'Home plane', type: 'text', placeholder: 'The Elemental Plane of Water' },
        ],
      },
    ],
  },

  settlement: {
    category: 'settlement',
    label: 'Settlement',
    group: 'Places',
    icon: 'LocationCity',
    sections: [
      {
        label: 'Overview',
        fields: [
          { key: 'population', label: 'Population', type: 'number', placeholder: '24000' },
          { key: 'inhabitantDemonym', label: 'Inhabitant demonym', type: 'text', placeholder: 'Silverportian' },
          { key: 'locationUnder', label: 'Location under', type: 'text', placeholder: 'The Sundered Coast' },
          { key: 'rulerOwner', label: 'Ruler / Owner', type: 'text', placeholder: 'The Silver Hand merchant guild' },
          { key: 'government', label: 'Government', type: 'text', placeholder: 'Merchant council' },
        ],
      },
      {
        label: 'Economy & defense',
        fields: [
          { key: 'economicSources', label: 'Economic sources', type: 'itemlist', bankKey: 'settlementEconomicSources' },
          { key: 'currency', label: 'Currency', type: 'text', placeholder: 'Silver crowns' },
          { key: 'defenses', label: 'Defenses', type: 'text', placeholder: 'Sea wall, harbor chain' },
        ],
      },
      {
        label: 'Character',
        fields: [
          { key: 'definingTrait', label: 'Defining trait', type: 'itemlist', bankKey: 'settlementDefiningTraits' },
          { key: 'claimToFame', label: 'Claim to fame', type: 'itemlist', bankKey: 'settlementClaimsToFame' },
          { key: 'currentCalamity', label: 'Current calamity', type: 'itemlist', bankKey: 'settlementCalamities' },
          { key: 'localLeader', label: 'Local leader', type: 'itemlist', bankKey: 'settlementLocalLeaders' },
        ],
      },
      {
        label: 'Districts & notes',
        fields: [
          { key: 'districts', label: 'Districts', type: 'text', placeholder: 'The Docks, High Quarter, The Warrens' },
          { key: 'notablePeople', label: 'Noteworthy people', type: 'textarea', placeholder: 'Names and one-line hooks…' },
          { key: 'notablePlaces', label: 'Noteworthy places', type: 'textarea', placeholder: 'Names and one-line hooks…' },
          { key: 'priciestItemValue', label: 'GP value of the most expensive item for sale', type: 'text', placeholder: '500 gp' },
        ],
      },
      {
        label: 'Rumors & hooks',
        fields: [{ key: 'rumorsAndHooks', label: 'Rumors & hooks', type: 'itemlist', bankKey: 'settlementRumorsHooks' }],
      },
    ],
  },

  geography: {
    category: 'geography',
    label: 'Geography',
    group: 'Places',
    icon: 'Terrain',
    sections: [
      {
        label: 'Overview',
        fields: [
          {
            key: 'geographyType',
            label: 'Type',
            type: 'select',
            options: ['Mountain', 'Forest', 'River', 'Desert', 'Coast', 'Plains', 'Swamp', 'Other'],
          },
          { key: 'locationUnder', label: 'Location under', type: 'text', placeholder: 'The Sundered Coast' },
          { key: 'climate', label: 'Climate', type: 'text', placeholder: 'Temperate, foggy' },
        ],
      },
      {
        label: 'Inhabitants & features',
        fields: [
          { key: 'inhabitants', label: 'Inhabitants', type: 'text', placeholder: 'Merfolk, coastal raiders' },
          { key: 'notableFeatures', label: 'Notable features', type: 'textarea', placeholder: 'A sunken lighthouse, tidal caves…' },
        ],
      },
    ],
  },

  building: {
    category: 'building',
    label: 'Building',
    group: 'Places',
    icon: 'HomeWork',
    sections: [
      {
        label: 'Overview',
        fields: [
          {
            key: 'buildingType',
            label: 'Type',
            type: 'select',
            options: ['Tavern', 'Temple', 'Shop', 'Tower', 'Keep', 'Warehouse', 'Other'],
          },
          { key: 'locationUnder', label: 'Location under', type: 'text', placeholder: 'Silverport' },
          { key: 'owner', label: 'Owner', type: 'text', placeholder: 'Grum the Fence' },
          {
            key: 'shopType',
            label: 'Shop type',
            type: 'itemlist',
            bankKey: 'shopTypes',
            showWhen: { field: 'buildingType', equals: 'Shop' },
          },
        ],
      },
      {
        label: 'Purpose & features',
        fields: [
          { key: 'purpose', label: 'Purpose', type: 'text', placeholder: 'Fencing stolen goods behind a legitimate front' },
          { key: 'notableFeatures', label: 'Notable features', type: 'textarea', placeholder: 'A hidden cellar, a trapdoor behind the bar…' },
        ],
      },
    ],
  },

  dungeon: {
    category: 'dungeon',
    label: 'Dungeon',
    group: 'Places',
    icon: 'Castle',
    sections: [
      {
        label: 'Overview',
        fields: [
          { key: 'locationUnder', label: 'Location under', type: 'text', placeholder: 'The Sundered Coast' },
          { key: 'origin', label: 'Built / discovered by', type: 'text', placeholder: 'Dwarven miners, later abandoned' },
          { key: 'purpose', label: 'Purpose', type: 'text', placeholder: 'Treasure vault, tomb, stronghold…' },
        ],
      },
      {
        label: 'Condition & character',
        fields: [
          { key: 'statesOfRuin', label: 'State of ruin', type: 'itemlist', bankKey: 'dungeonStatesOfRuin' },
          { key: 'quirks', label: 'Quirks', type: 'itemlist', bankKey: 'dungeonQuirks' },
        ],
      },
      {
        label: 'Inhabitants & features',
        fields: [
          { key: 'inhabitants', label: 'Inhabitants', type: 'text', placeholder: 'Kobolds, an ancient guardian construct…' },
          { key: 'notableFeatures', label: 'Notable features', type: 'textarea', placeholder: 'A flooded lower level, a collapsed stair…' },
        ],
      },
    ],
  },

  country: {
    category: 'country',
    label: 'Country',
    group: 'Places',
    icon: 'Public',
    sections: [
      {
        label: 'Overview',
        fields: [
          { key: 'government', label: 'Government', type: 'text', placeholder: 'Feudal monarchy' },
          { key: 'ruler', label: 'Ruler', type: 'text', placeholder: 'Queen Ashen Vale III' },
          { key: 'capital', label: 'Capital', type: 'text', placeholder: 'Silverport' },
          { key: 'population', label: 'Population', type: 'number', placeholder: '2400000' },
        ],
      },
      {
        label: 'Territory & military',
        fields: [
          { key: 'territories', label: 'Territories / regions', type: 'text', placeholder: 'The Sundered Coast, the Ember Reaches' },
          { key: 'currency', label: 'Currency', type: 'text', placeholder: 'Silver crowns' },
          { key: 'militaryStrength', label: 'Military strength', type: 'text', placeholder: 'A standing navy, city militias' },
        ],
      },
    ],
  },

  faction: {
    category: 'faction',
    label: 'Faction',
    group: 'Powers & Things',
    icon: 'Groups',
    sections: [
      {
        label: 'Overview',
        fields: [
          { key: 'factionType', label: 'Type', type: 'text', placeholder: 'Guild, Cult, Noble House…' },
          { key: 'governance', label: 'Governance', type: 'text', placeholder: 'Council of Nine' },
          { key: 'headquarters', label: 'Headquarters', type: 'text', placeholder: 'Silverport' },
        ],
      },
      {
        label: 'Details',
        fields: [
          { key: 'goals', label: 'Goals', type: 'textarea', placeholder: 'What this faction wants…' },
          { key: 'notableMembers', label: 'Notable members', type: 'textarea', placeholder: 'Leaders, rivals, notable agents…' },
        ],
      },
    ],
  },

  item: {
    category: 'item',
    label: 'Item',
    group: 'Powers & Things',
    icon: 'Diamond',
    sections: [
      {
        label: 'Overview',
        fields: [
          {
            key: 'itemType',
            label: 'Item type',
            type: 'select',
            options: ['Weapon', 'Armor', 'Wondrous item', 'Potion', 'Scroll', 'Ring', 'Other'],
          },
          {
            key: 'rarity',
            label: 'Rarity',
            type: 'select',
            options: ['Common', 'Uncommon', 'Rare', 'Very rare', 'Legendary', 'Artifact'],
          },
          { key: 'attunement', label: 'Requires attunement', type: 'select', options: ['Yes', 'No'] },
        ],
      },
      {
        label: 'Ownership',
        fields: [
          { key: 'value', label: 'Value', type: 'text', placeholder: '500 gp' },
          { key: 'ownerOrLocation', label: 'Owner / Location', type: 'text', placeholder: 'Vault of Silverport' },
        ],
      },
    ],
  },

  spell: {
    category: 'spell',
    label: 'Spell',
    group: 'Powers & Things',
    icon: 'AutoFixHigh',
    sections: [
      {
        label: 'Overview',
        fields: [
          {
            key: 'school',
            label: 'School',
            type: 'select',
            options: ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'],
          },
          { key: 'level', label: 'Level', type: 'text', placeholder: 'Cantrip, 1st, 2nd…' },
          { key: 'castingTime', label: 'Casting time', type: 'text', placeholder: '1 action' },
          { key: 'range', label: 'Range', type: 'text', placeholder: '60 feet' },
        ],
      },
      {
        label: 'Effect',
        fields: [
          { key: 'components', label: 'Components', type: 'text', placeholder: 'V, S, M (a pinch of sulfur)' },
          { key: 'duration', label: 'Duration', type: 'text', placeholder: 'Instantaneous' },
          { key: 'effect', label: 'Effect', type: 'textarea', placeholder: 'What the spell actually does…' },
        ],
      },
    ],
  },

  plot: {
    category: 'plot',
    label: 'Plot',
    group: 'Story',
    icon: 'Route',
    sections: [
      {
        label: 'Overview',
        fields: [{ key: 'status', label: 'Status', type: 'select', options: ['Planned', 'Active', 'Completed', 'Abandoned'] }],
      },
      {
        label: 'Premise & hooks',
        fields: [
          { key: 'premise', label: 'Premise', type: 'textarea', placeholder: "What's actually going on…" },
          { key: 'hooks', label: 'Hooks', type: 'textarea', placeholder: 'How the party gets pulled in…' },
        ],
      },
      {
        label: 'Stakes & involved',
        fields: [
          { key: 'stakes', label: 'Stakes', type: 'textarea', placeholder: 'What happens if the party fails…' },
          { key: 'involved', label: 'Involved NPCs / Factions / Locations', type: 'textarea' },
        ],
      },
    ],
  },

  event: {
    category: 'event',
    label: 'Event',
    group: 'Story',
    icon: 'Event',
    sections: [
      {
        label: 'Overview',
        fields: [
          { key: 'dateOrEra', label: 'Date / Era', type: 'text', placeholder: 'Year 412, Age of Kings' },
          { key: 'location', label: 'Location', type: 'text', placeholder: 'Silverport' },
        ],
      },
      {
        label: 'Details',
        fields: [
          { key: 'participants', label: 'Participants', type: 'textarea' },
          { key: 'outcome', label: 'Outcome', type: 'textarea' },
        ],
      },
    ],
  },
};

export const ARTICLE_GROUPS: ArticleGroup[] = ['People', 'Places', 'Powers & Things', 'Story'];

export function getArticleTemplatesByGroup(group: ArticleGroup): ArticleTemplate[] {
  return Object.values(ARTICLE_TEMPLATES).filter((t) => t.group === group);
}

/** Filters a template's sections down to the fields that don't duplicate the linked entity's
 * own card (see ArticleFieldDef.hideWhenLinkedTo) and drops any section left with zero
 * fields - the single source of truth for both the editor's "More options" and the
 * read/preview field-box grid, so a hidden-for-NPC field never surfaces in either place. */
export function getVisibleSections(
  template: ArticleTemplate,
  linkedEntityType: ArticleLinkedEntityType | null | undefined,
): ArticleSectionDef[] {
  return template.sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) => !linkedEntityType || !field.hideWhenLinkedTo?.includes(linkedEntityType)),
    }))
    .filter((section) => section.fields.length > 0);
}

/** Fallback cover image shown wherever an Article's cover displays (editor banner, preview,
 * read view) when no image has been uploaded - display-time only, never written into
 * coverImageSrc state/DB, so a real upload always overrides it. */
export const DEFAULT_ARTICLE_COVER_IMAGE =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTGC3Va9SasoJKCZCo_rReOZ2f820xGsUUMjr9jiqBfHjZvMvP3Kzlvw-9m&s=10';

export type ArticleVisibility = 'gm' | 'player' | 'published';

export const ARTICLE_VISIBILITY_OPTIONS: { value: ArticleVisibility; label: string }[] = [
  { value: 'gm', label: 'GM only' },
  { value: 'player', label: 'Player-visible' },
  { value: 'published', label: 'Published' },
];

/** What kind of "real" (DB-backed) game entity an article can document - see issue 4a/4c/
 * 4f/4g/4h: creating (or editing) one of these can optionally spin off a linked Article. */
export type ArticleLinkedEntityType = 'npc' | 'creature' | 'spell' | 'item' | 'faction' | 'quest' | 'bastion';

export const LINKED_ENTITY_TYPE_LABEL: Record<ArticleLinkedEntityType, string> = {
  npc: 'NPC',
  creature: 'Creature',
  spell: 'Spell',
  item: 'Magic item',
  faction: 'Faction',
  quest: 'Quest',
  bastion: 'Bastion',
};

/** Which article template a newly-linked article defaults to for a given entity type -
 * NPCs/Creatures both read as a "Character" article, Spells/Items map 1:1, Quests read as
 * "Plot" (no dedicated Quest template) and Bastions read as "Building" (a stronghold). */
export function getArticleCategoryForLinkedEntityType(type: ArticleLinkedEntityType): ArticleCategory {
  if (type === 'npc' || type === 'creature') return 'character';
  if (type === 'quest') return 'plot';
  if (type === 'bastion') return 'building';
  return type;
}

/** What the 4 entity FormDialogs report back to their caller about the "also create a world
 * article" checkbox (issue 4c/4h/4g) - null when the checkbox was off, otherwise the new
 * article's id when "create it now" was checked so the caller can navigate straight into it
 * (a checked-but-"leave blank" article still gets created, it's just not navigated to). */
export type ArticleLinkOutcome = { createdArticleId: string } | null;

/** Shared by the 4 entity FormDialogs' "also create a world article" checkbox (issue 4c/4h)
 * and ArticleTypePicker's "create article for an existing item" flow (issue 4f) - one place
 * that knows what a freshly-linked, still-blank Article looks like. */
export function buildLinkedArticle(worldId: string, type: ArticleLinkedEntityType, entityId: string, entityName: string): Article {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    worldId,
    folderId: null,
    category: getArticleCategoryForLinkedEntityType(type),
    name: entityName,
    coverImageSrc: '',
    tags: [],
    visibility: 'gm',
    fieldValues: {},
    body: '',
    linkedEntityType: type,
    linkedEntityId: entityId,
    createdAt: now,
    updatedAt: now,
  };
}

export interface Article {
  id: string;
  worldId: string;
  folderId: string | null;
  category: ArticleCategory;
  name: string;
  coverImageSrc: string;
  tags: string[];
  visibility: ArticleVisibility;
  fieldValues: Record<string, string>;
  body: string;
  linkedEntityType: ArticleLinkedEntityType | null;
  linkedEntityId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ArticleFolder {
  id: string;
  worldId: string;
  parentId: string | null;
  name: string;
}
