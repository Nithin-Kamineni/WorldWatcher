import type { ArticleCategory } from '../../../types/article';

function secret(title: string, hint: string): string {
  return `<div data-type="secret-block" data-title="${title}" data-open="false"><p><em>${hint}</em></p></div>`;
}

function collapsible(title: string, inner: string): string {
  return `<div data-type="collapsible-block" data-title="${title}" data-open="true">${inner}</div>`;
}

function section(heading: string, hint: string): string {
  return `<h2>${heading}</h2><p><em>${hint}</em></p>`;
}

/** Best-intuition starting scaffolds for a brand new article's body, one per
 * ArticleCategory (types/article.ts) - WorldAnvil-style "template" content: real headings and
 * italic prompt text the author overwrites, not a UI placeholder. Only used to seed a NEW
 * article's body (see ArticleForm) - never applied when editing an existing one. */
const ARTICLE_BODY_TEMPLATES: Record<ArticleCategory, string> = {
  character:
    section('Description', 'Physical appearance, mannerisms, how they carry themselves…') +
    section('Personality', 'Values, quirks, what they want, what they fear…') +
    section('History', 'Where they came from and what shaped them…') +
    section('Relationships', 'Allies, rivals, family, who they trust or distrust…') +
    secret('Secrets & hooks', "Something only the GM knows about this character, and how the party might uncover it…"),

  deity:
    section('Domain & Symbol', 'What they govern, and the holy symbol worshippers wear or carry…') +
    section('Dogma & Teachings', 'What followers believe and how they’re expected to live…') +
    section('Worship & Clergy', 'Rites, holy days, how the priesthood is organized…') +
    section('History & Myths', 'Origin myths, famous legends, other gods they feud with or favor…') +
    secret('Secrets', "The god's true agenda, a forgotten aspect, or a rival's grudge…"),

  settlement:
    section('Overview', 'First impression on arrival - sights, sounds, smells, what makes it distinct…') +
    section('History', "Founding, major events, how it got its name…") +
    collapsible(
      'Notable Locations',
      '<ul><li><p><strong>The docks</strong> – …</p></li><li><p><strong>The market square</strong> – …</p></li><li><p><strong>?</strong> – …</p></li></ul>',
    ) +
    collapsible(
      'Notable NPCs',
      '<ul><li><p><strong>Name</strong> – role, one-line hook…</p></li></ul>',
    ) +
    section('Culture & Daily Life', 'Customs, festivals, food, what the average day looks like…') +
    secret('Secrets & Rumors', "What's really going on beneath the surface, and what the rumor mill says instead…"),

  geography:
    section('Description', 'What it looks and feels like to stand here…') +
    section('Formation / Origin', 'Natural formation, magical accident, ancient cataclysm…') +
    section('Flora & Fauna', 'Notable plants and creatures native to this place…') +
    section('Dangers', 'Terrain hazards, predators, weather, curses…') +
    secret('Hidden features', 'A concealed cave, a buried ruin, something only found by searching…'),

  building:
    section('Exterior', 'What it looks like from the street - size, materials, condition, signage…') +
    section('Interior', 'Layout, notable rooms, atmosphere…') +
    section("Who's Inside", 'Owner, staff, regulars, guards…') +
    secret('Hidden rooms & secrets', 'A false wall, a smuggler’s cellar, something the owner doesn’t advertise…'),

  dungeon:
    section('Layout & Atmosphere', 'How it’s laid out, and what it feels like to explore…') +
    section('History', 'Who built it, why it was abandoned, what happened here…') +
    section('Inhabitants & Hazards', 'Monsters, traps, environmental dangers…') +
    section('Treasure', 'What’s worth finding, and where it’s hidden…') +
    secret('Traps & Secrets', 'A hidden lever, a false floor, the real reason this place is dangerous…'),

  country:
    section('Overview', 'National identity, borders, what it’s known for…') +
    section('Government & Politics', 'Who rules, how power actually works, current tensions…') +
    section('Culture & People', 'Customs, values, major settlements, notable exports…') +
    section('History', 'Founding, wars, golden ages, decline…') +
    secret('Political secrets', 'A conspiracy at court, a hidden alliance, a succession crisis brewing…'),

  faction: `${section('Purpose & Ideology', 'What this faction wants, and what it believes justifies getting it…')}${section(
    'Structure & Leadership',
    'How decisions get made, who’s actually in charge…',
  )}${collapsible('Notable Members', '<ul><li><p><strong>Name</strong> – role, one-line hook…</p></li></ul>')}${section(
    'Relationships',
    'Allies, rivals, who they’re at war or in bed with…',
  )}${secret('True agenda', 'What the leadership actually wants, hidden even from most of its own members…')}`,

  item:
    section('Description', 'What it looks like, how it feels to hold, any distinguishing marks…') +
    section('Powers & Properties', 'What it actually does, and any drawbacks or costs…') +
    section('History', 'Who made it, previous owners, how it was lost or found…') +
    secret('Hidden property', 'A curse, a sentience, a true purpose the wielder doesn’t know about…'),

  spell:
    section('Flavor & Description', 'What it looks, sounds, or feels like when cast…') +
    section('Lore', 'Who first devised it, who teaches it, how widely it’s known…'),

  plot:
    section('Summary', 'The one-paragraph pitch - what this plot is really about…') +
    '<h2>Key Beats</h2><ol><li><p>…</p></li><li><p>…</p></li><li><p>…</p></li></ol>' +
    section('Involved', 'NPCs, factions, and locations tangled up in this…') +
    secret('Twist', "Don't tell your players! The reveal that recontextualizes everything…") +
    section('Resolution', 'How this could wrap up - and what changes afterward…'),

  event:
    section('What Happened', 'The event itself, blow by blow…') +
    section('Causes', 'What led to this - who or what set it in motion…') +
    section('Aftermath', 'What changed afterward, and who was affected…') +
    secret('Hidden truth', 'What really happened, versus what most people believe…'),
};

export function getArticleBodyTemplate(category: ArticleCategory): string {
  return ARTICLE_BODY_TEMPLATES[category] ?? '';
}
