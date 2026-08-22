/** Top-level guided tour: the navbar controls plus the DM Panel's main tabs. Each step
 * targets an element carrying a matching `data-tour="..."` attribute (see AppShell.tsx and
 * DMPanelPage.tsx). A step is skipped automatically if its target isn't in the DOM (e.g. the
 * tour was started from a page with no DM tabs), so this list is safe to walk from anywhere
 * in the app. */
export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'brand',
    title: 'Welcome to WorldWatcher',
    description: 'This is your D&D campaign toolkit - a quick tour of the tools in the navbar and DM Panel. Click here to begin.',
    targetSelector: '[data-tour="navbar-brand"]',
  },
  {
    id: 'theme-toggle',
    title: 'Light / dark mode',
    description: 'Click this to switch between light and dark themes - handy for a dim table at game night.',
    targetSelector: '[data-tour="theme-toggle"]',
  },
  {
    id: 'tab-maps',
    title: 'Maps',
    description: 'Click the Maps tab to manage battle maps and floors, and open the token/combat view.',
    targetSelector: '[data-tour="tab-maps"]',
  },
  {
    id: 'tab-encounters',
    title: 'Encounters',
    description: 'Click Encounters to build fixed or random-table encounters, and group them into random encounter tables.',
    targetSelector: '[data-tour="tab-encounters"]',
  },
  {
    id: 'tab-compendium',
    title: 'Compendium',
    description: 'Click Compendium to browse monster stat blocks, spells, and magic items.',
    targetSelector: '[data-tour="tab-compendium"]',
  },
  {
    id: 'tab-npcs',
    title: 'NPCs',
    description: 'Click NPCs to manage the people in your campaign - build one from scratch or base it on a monster stat block.',
    targetSelector: '[data-tour="tab-npcs"]',
  },
  {
    id: 'tab-factions',
    title: 'Factions',
    description: 'Click Factions to track the powers in your world - switch to the diplomacy graph to see how they relate to each other.',
    targetSelector: '[data-tour="tab-factions"]',
  },
  {
    id: 'tab-quests',
    title: 'Quests',
    description: "Click Quests to track your players' objectives and tie them back to factions.",
    targetSelector: '[data-tour="tab-quests"]',
  },
  {
    id: 'tab-bastions',
    title: 'Bastions',
    description: "Click Bastions to track each player character's stronghold and its facilities.",
    targetSelector: '[data-tour="tab-bastions"]',
  },
  {
    id: 'tab-notes',
    title: 'Notes',
    description: 'Click Notes for freeform campaign notes.',
    targetSelector: '[data-tour="tab-notes"]',
  },
];
