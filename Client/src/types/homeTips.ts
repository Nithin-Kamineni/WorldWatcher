export type HomeTipAudience = 'player' | 'dm' | 'app';

export interface HomeTip {
  id: string;
  audience: HomeTipAudience;
  text: string;
}

/** Bank of rotating tips for the World Home page's Tips widget - a mix of player-facing,
 * DM-facing, and app-usage tips. App-usage tips are kept accurate to real features (see
 * `components/layout/tutorialSteps.ts` for the guided tour this mirrors, and the map toolbar/
 * token manager for the drag-and-drop/floor-lock specifics) rather than invented ones. */
export const HOME_TIPS: HomeTip[] = [
  { id: 'app-command-palette', audience: 'app', text: 'Press Ctrl/Cmd+K anywhere to jump straight to a world, campaign, or page without touching the mouse.' },
  { id: 'app-token-drag', audience: 'app', text: 'Open Manage Tokens on a map and drag a favorite token straight onto the battle grid to place it.' },
  { id: 'app-encounter-lock', audience: 'app', text: 'Lock an encounter to a floor in Manage Tokens so its monsters stay put when you switch floors mid-fight.' },
  { id: 'app-hybrid-view', audience: 'app', text: 'The World icon in the rail opens Hybrid view by default - a rotating grid of your articles, not just a flat list.' },
  { id: 'app-resume', audience: 'app', text: 'The Resume card on this page always points at the last section you were actually working in - click Continue to jump right back.' },
  { id: 'app-campaign-switch', audience: 'app', text: 'Use the world/campaign switcher in the top bar to hop between campaigns without losing your place in the rail.' },
  { id: 'app-npc-from-monster', audience: 'app', text: 'Building an NPC? You can base its stat block on an existing monster from the Compendium instead of starting blank.' },
  { id: 'app-faction-graph', audience: 'app', text: 'Switch Factions to the diplomacy graph view to see alliances and rivalries at a glance instead of a plain list.' },
  { id: 'app-random-tables', audience: 'app', text: 'Group encounters into a random encounter table so the DM Panel can roll one for you mid-session.' },
  { id: 'app-quests-factions', audience: 'app', text: 'Link a quest to a faction and it shows up automatically wherever that faction is referenced.' },
  { id: 'app-theme-toggle', audience: 'app', text: 'Toggle light/dark mode from the top bar - dark mode is easier on the eyes at a dim table.' },
  { id: 'dm-secret-notes', audience: 'dm', text: "Keep a running Notes page for secrets your players haven't discovered yet - future you will thank present you." },
  { id: 'dm-prep-encounters', audience: 'dm', text: 'Pre-build encounters before session zero of a dungeon crawl so you can drop them onto the map without breaking pace.' },
  { id: 'dm-bastion-facilities', audience: 'dm', text: "Track each player character's Bastion facilities so downtime upgrades do not get forgotten between sessions." },
  { id: 'dm-faction-motives', audience: 'dm', text: 'Give every major faction one concrete short-term goal - it makes improvising their next move much easier.' },
  { id: 'dm-foreshadow', audience: 'dm', text: 'Drop one small clue about your next plot beat into an NPC conversation at least a session before it matters.' },
  { id: 'player-note-npcs', audience: 'player', text: "Jot down the names of NPCs you meet - the DM's world is bigger than what fits in one session of notes." },
  { id: 'player-read-handouts', audience: 'player', text: 'Re-read published articles about your character\'s homeland before a session set there - small details make great roleplay hooks.' },
  { id: 'player-ask-motivation', audience: 'player', text: "If your character's motivation feels stale, ask your DM for a personal quest hook tied to their backstory." },
  { id: 'player-bastion-downtime', audience: 'player', text: 'Spend downtime on your Bastion between adventures - facilities compound in usefulness the earlier you invest.' },
];
