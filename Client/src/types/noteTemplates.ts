/** Note templates for the Notes feature (see NotesFolderExplorer's quick-create buttons). One
 * session template (used directly - there's only one) and six narrative templates (offered
 * through a picker, since Narrative planning spans several distinct document shapes -
 * arc/villain/faction/brainstorm - unlike a session prep sheet).
 *
 * These EMIT HTML, the format TipTapArticleEditor reads and writes. They used to build BBCode
 * and rely on toEditorHtml converting it on first open, which rendered correctly but meant a
 * brand-new note's source was a format nothing in the app writes any more - and the round trip
 * flattened the numbered outline into plain "1. / 2." text with <br>s, because bbcodeToHtml has
 * no ordered list (checklist I-N1). Every builder below is unchanged; only these six helpers
 * are, which is what keeps the templates themselves readable. */

export interface NoteTemplate {
  id: string;
  label: string;
  description: string;
  build: (name: string) => string;
}

/** Template text is authored here, not by a user, but it still goes through an escape - a
 * prompt someone adds later containing "&" or "<" must not silently become markup. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function heading1(text: string): string {
  return `<h1>${escapeHtml(text)}</h1>`;
}

function heading2(text: string): string {
  return `<h2>${escapeHtml(text)}</h2>`;
}

function heading3(text: string): string {
  return `<h3>${escapeHtml(text)}</h3>`;
}

/** TipTap's listItem holds block content, so every item wraps its text in a paragraph. */
function listItems(items: string[]): string {
  return items.map((item) => `<li><p>${escapeHtml(item)}</p></li>`).join('');
}

function bulletBlock(items: string[]): string {
  return `<ul>${listItems(items)}</ul>`;
}

/** A field group: a title (h2 for flat templates, h3 when nested under an h2 group) followed
 * by its "- label / prompt" lines as a bullet list - mirrors the "- " lines the DM's source
 * templates use for every fillable prompt. */
function section(title: string, fields: string[], level: 2 | 3 = 2): string {
  return (level === 2 ? heading2(title) : heading3(title)) + bulletBlock(fields);
}

/** A real ordered list now, not "1. " typed into paragraphs - the numbering is structure the
 * editor maintains as beats are added or dropped. */
function numberedList(items: string[]): string {
  return `<ol>${listItems(items)}</ol>`;
}

/** A tickable checklist (TaskList/TaskItem - see TipTapArticleEditor). The session outline is
 * the one thing on a prep sheet that is a run order rather than a form to fill in, and the DM
 * reads it during play - so it gets boxes they can tick off as the session moves, from the
 * note's own reading view (checklist F2.2 / I-N2). */
function checklist(items: string[]): string {
  return `<ul data-type="taskList">${items
    .map((item) => `<li data-type="taskItem" data-checked="false"><p>${escapeHtml(item)}</p></li>`)
    .join('')}</ul>`;
}

function buildSessionPrepTemplate(name: string): string {
  return [
    heading1(name),

    heading2('Outline'),
    checklist(['[Situation / Moment]', '[Situation / Moment]', '[Event]', '[Situation / Moment]', '[Event]', '[Combat / Encounter]', '[Ending]']),

    heading2('Moments'),
    section('Start', ['What is happening when the session begins?', 'Where are the characters?', 'What immediately requires their attention?'], 3),
    section('Moment 1: [Name]', ['Situation:', 'Important information:', 'Possible developments:'], 3),
    section('Moment 2: [Name]', ['Situation:', 'Important information:', 'Possible developments:'], 3),
    section('Encounter 1: [Name]', ['Setup:', 'Enemies / obstacles:', 'Objective:', 'Important mechanics:', 'Possible outcomes:'], 3),
    section('Session End', ['Planned stopping point:', 'Cliffhanger / revelation / event:', 'What could lead into the next session?'], 3),

    heading2('Character Moments'),
    section('PC 1: [Character Name]', ['Personal moment:', 'Backstory development:', 'NPC / event involved:', 'Information, decision, or opportunity:'], 3),
    section('PC 2: [Character Name]', ['Personal moment:', 'Backstory development:', 'NPC / event involved:', 'Information, decision, or opportunity:'], 3),
    section('PC 3: [Character Name]', ['Personal moment:', 'Backstory development:', 'NPC / event involved:', 'Information, decision, or opportunity:'], 3),

    heading2('Location Details'),
    section('City / Region: [Name]', ['Description:', 'Relevant information:'], 3),
    section('Place 1: [Name]', ['Description:', 'Important features:', 'Relevant NPCs / items:'], 3),
    section('Place 2: [Name]', ['Description:', 'Important features:', 'Relevant NPCs / items:'], 3),

    heading2('People'),
    section('Person 1: [Name]', ['Who are they?', 'Appearance / personality / voice:', 'What are they doing this session?', 'Relevant abilities or information:'], 3),
    section('Plot Information', ['What do they know?', 'What are they hiding?', 'What do they want?'], 3),
    section('Person 2: [Name]', ['Who are they?', 'Appearance / personality / voice:', 'What are they doing this session?', 'Relevant abilities or information:'], 3),
    section('Plot Information', ['What do they know?', 'What are they hiding?', 'What do they want?'], 3),
    section('Person 3: [Name]', ['Who are they?', 'Appearance / personality / voice:', 'What are they doing this session?', 'Relevant abilities or information:'], 3),
    section('Plot Information', ['What do they know?', 'What are they hiding?', 'What do they want?'], 3),

    heading2('Plot Lines'),
    section('Plot Line 1: [Name]', ['Current situation:', 'What is happening right now?', 'What happens if the players do nothing?'], 3),
    section('Plot Line 2: [Name]', ['Current situation:', 'What is happening right now?', 'What happens if the players do nothing?'], 3),
    section('Plot Line 3: [Name]', ['Current situation:', 'What is happening right now?', 'What happens if the players do nothing?'], 3),
  ].join('');
}

function buildCampaignArcTemplate(name: string): string {
  return [
    heading1(`Campaign Arc: ${name}`),
    section('Core Concept', ['What is the campaign fundamentally about?']),
    section('Central Conflict', ['What major problem spans the campaign?']),
    section('Long-Term Threat / Antagonist', ['Who or what drives the main conflict?']),
    section('Campaign Goal', ['What might the characters eventually need to accomplish?']),
    section('Campaign End State', ['What could resolving the campaign look like?']),
    section('Themes', ['[Theme]', '[Theme]', '[Theme]']),
    section('Tone', ['[Tone]']),
    section('Major Locations', ['[Location]', '[Location]']),
    section('Major Factions', ['[Faction]', '[Faction]']),
    section('Major Villains', ['[Villain]', '[Villain]']),
    heading2('Narrative Arcs') + numberedList(['[Narrative Arc]', '[Narrative Arc]', '[Narrative Arc]', '[Narrative Arc]']),
  ].join('');
}

function buildNarrativeArcTemplate(name: string): string {
  return [
    heading1(`Narrative Arc: ${name}`),
    section('Parent Campaign Arc', ['[Campaign Arc]']),
    section('Arc Premise', ['What is this part of the campaign about?']),
    section('Initiating Event', ['What begins this arc?']),
    section('Current Situation', ['What is happening when the arc begins?']),
    section('Player Objective', ['What do the players currently believe they need to accomplish?']),
    section('Primary Antagonist / Opposition', ['Who or what opposes them?']),
    section('Antagonist Goal', ['What do they want?']),
    section('Antagonist Motivation', ['Why do they want it?']),
    section('If Nobody Interferes', ['What eventually happens?']),
    section('Important Locations', ['[Location]', '[Location]', '[Location]']),
    section('Important NPCs', ['[NPC]', '[NPC]', '[NPC]']),
    section('Possible Solutions', ['[Possible approach]', '[Possible approach]', '[Possible approach]']),
    section('Possible Cool Moments', ['[Battle / reveal / location / event]', '[Battle / reveal / location / event]', '[Battle / reveal / location / event]']),
    section('Major Discoveries', ['[Discovery]', '[Discovery]']),
    section('Possible Arc Resolution', ['What conditions could end this arc?']),
    section('Bridge to Next Arc', ['What discovery, consequence, NPC, threat, or event could lead into another arc?']),
    heading2('Immediate Arcs') + numberedList(['[Immediate Arc]', '[Immediate Arc]', '[Immediate Arc]', '[Immediate Arc]']),
  ].join('');
}

function buildImmediateArcTemplate(name: string): string {
  return [
    heading1(`Immediate Arc: ${name}`),
    section('Parent Narrative Arc', ['[Narrative Arc]']),
    section('Current Problem', ['What is the party dealing with right now?']),
    section('Goal', ['What are the characters trying to accomplish?']),
    section('Starting Situation', ['Where and how does this Immediate Arc begin?']),
    section('Important NPCs', ['[NPC]', '[NPC]']),
    section('Important Locations', ['[Location]', '[Location]']),
    section('Important Enemies / Obstacles', ['[Enemy / obstacle]', '[Enemy / obstacle]']),
    section('Clues / Information', ['[Clue]', '[Clue]', '[Clue]']),
    section('Possible Encounters', ['[Encounter]', '[Encounter]']),
    section('Possible Complications', ['[Complication]', '[Complication]']),
    section('Possible Resolution', ['How might this Immediate Arc end?']),
    section('Consequences', ['What changes after it ends?']),
    section('Related Sessions', ['Session [#]: [Name]', 'Session [#]: [Name]', 'Session [#]: [Name]']),
  ].join('');
}

function buildNarrativeArcBrainstormTemplate(name: string): string {
  return [
    heading1(`Narrative Arc Session Brainstorm: ${name}`),
    section('Estimated Sessions', ['[Number]']),
    section('Session 1', ['[Known opening / initiating event]']),
    section('Session 2', ['???']),
    section('Session 3', ['???']),
    section('Session 4', ['???']),
    section('Session 5', ['[Possible midpoint / major event]']),
    section('Session 6', ['???']),
    section('Session 7', ['???']),
    section('Session 8', ['???']),
    section('Session 9', ['???']),
    section('Session 10', ['[Possible climax / resolution]']),
  ].join('');
}

function buildVillainPlotTemplate(name: string): string {
  return [
    heading1(`Villain: ${name}`),
    section('Role', ['Who are they?']),
    section('Goal', ['What do they ultimately want?']),
    section('Motivation', ['Why do they want it?']),
    section('Current Situation', ['What are they doing right now?']),
    section('Resources', ['Allies:', 'Followers:', 'Money:', 'Political influence:', 'Military strength:', 'Magic / artifacts:', 'Other resources:']),
    heading2('Plan'),
    section('Step 1', ['[Action]'], 3),
    section('Step 2', ['[Action]'], 3),
    section('Step 3', ['[Action]'], 3),
    section('Step 4', ['[Action]'], 3),
    section('Final Goal', ['[Action / outcome]'], 3),
    section('If Nobody Stops Them', ['What happens?']),
    section('Reaction to Player Interference', ['How will they respond if the party disrupts the plan?']),
    section('Weaknesses', ['[Weakness]', '[Weakness]']),
    section('Secrets', ['[Secret]', '[Secret]']),
    section('Connections', ['Related factions:', 'Related NPCs:', 'Related locations:', 'Related Narrative Arcs:']),
  ].join('');
}

function buildFactionGoalsTemplate(name: string): string {
  return [
    heading1(`Faction: ${name}`),
    section('Identity', ['What is this faction?']),
    section('Description', ['What are they known for?']),
    section('Primary Goal', ['What do they ultimately want?']),
    section('Secondary Goals', ['[Goal]', '[Goal]', '[Goal]']),
    section('Motivation', ['Why are they pursuing these goals?']),
    section('Leadership', ['[NPC]', '[NPC]']),
    section('Important Members', ['[NPC]', '[NPC]']),
    section('Resources', ['[Resource]', '[Resource]']),
    section('Headquarters', ['[Location]']),
    section('Controlled Locations', ['[Location]', '[Location]']),
    section('Allies', ['[Faction / NPC]', '[Faction / NPC]']),
    section('Enemies', ['[Faction / NPC]', '[Faction / NPC]']),
    section('Current Activities', ['What are they doing right now?']),
    section('Current Plot', ['What are they actively trying to accomplish?']),
    section('If Nobody Stops Them', ['What happens?']),
    section('Relationship With Party', ['Friendly / Neutral / Hostile / Unknown']),
    section('Party Reputation', ['How does the faction currently view the characters?']),
    section('Secrets', ['[Secret]', '[Secret]']),
    section('Recent Developments', ['[Development]', '[Development]']),
  ].join('');
}

export const SESSION_TEMPLATES: NoteTemplate[] = [
  {
    id: 'session-prep',
    label: 'Session Prep',
    description: "Prepare an individual game session - outline, moments, character beats, locations, people, and plot lines.",
    build: buildSessionPrepTemplate,
  },
];

export const NARRATIVE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'campaign-arc',
    label: 'Campaign Arc',
    description: 'The highest-level story of the campaign - overarching conflict, theme, and direction. Stays broad and flexible.',
    build: buildCampaignArcTemplate,
  },
  {
    id: 'narrative-arc',
    label: 'Narrative Arc',
    description: 'A medium-sized section of the campaign, like a season of a show - a major storyline spanning several sessions.',
    build: buildNarrativeArcTemplate,
  },
  {
    id: 'immediate-arc',
    label: 'Immediate Arc',
    description: 'The short-term problem facing the party right now - usually one to three sessions (a dungeon, a mystery, a rescue).',
    build: buildImmediateArcTemplate,
  },
  {
    id: 'narrative-arc-brainstorm',
    label: 'Narrative Arc Session Brainstorm',
    description: 'Loosely sketch how a Narrative Arc may develop across sessions - anchor known events, leave the rest unknown.',
    build: buildNarrativeArcBrainstormTemplate,
  },
  {
    id: 'villain-plot',
    label: 'Villain Plot',
    description: "Track a villain's goals, motivations, resources, and step-by-step plan - what they intend to do, not what the players will do.",
    build: buildVillainPlotTemplate,
  },
  {
    id: 'faction-goals',
    label: 'Faction Goals',
    description: 'Track an organization, guild, cult, or other faction - its goals, leadership, resources, and current plot.',
    build: buildFactionGoalsTemplate,
  },
];
