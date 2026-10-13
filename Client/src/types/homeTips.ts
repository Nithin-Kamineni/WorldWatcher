export type HomeTipAudience = 'player' | 'dm' | 'app';

export interface HomeTip {
  id: string;
  audience: HomeTipAudience;
  text: string;
}

/** Bank of rotating tips for the World Home page's Tips widget - a mix of player-facing,
 * DM-facing, and app-usage tips. App-usage tips are kept accurate to real features (the map
 * sidebar, right-click menus, fog of war, initiative, the Play page) rather than invented ones:
 * when a feature moves, the tip that describes it has to move with it - two of the old ones
 * still pointed at the retired "Manage Tokens" toolbar popover. */
export const HOME_TIPS: HomeTip[] = [
  // ---- Getting around ----
  { id: 'app-command-palette', audience: 'app', text: 'Press Ctrl/Cmd+K anywhere to jump straight to a world, campaign, or page without touching the mouse.' },
  { id: 'app-resume', audience: 'app', text: 'The Resume card on this page always points at the last section you were actually working in - click Continue to jump right back.' },
  { id: 'app-campaign-switch', audience: 'app', text: 'Use the world/campaign switcher in the top bar to hop between campaigns without losing your place in the rail.' },
  { id: 'app-theme-toggle', audience: 'app', text: 'Toggle light/dark mode from the top bar - dark mode is easier on the eyes at a dim table.' },
  { id: 'app-ui-scale', audience: 'app', text: 'Everything too small or too big? Settings has a UI scale slider that resizes the whole app at once.' },
  { id: 'app-rail-labels', audience: 'app', text: 'Prefer words to icons? Turn on "Icon rail labels" in Settings to show a name under every rail icon.' },
  { id: 'app-dashboard-customize', audience: 'app', text: 'Hide the dashboard cards you never look at - the Customize button above them opens the widget switches in Settings.' },
  { id: 'app-world-cover', audience: 'app', text: 'Give each world its own mood: use Change cover on the banner at the top of this page to upload a wide landscape image.' },

  // ---- World Manager ----
  { id: 'app-hybrid-view', audience: 'app', text: 'World Manager views open in Hybrid mode by default - a rotating grid of your entries. Switch to Table for a sortable list.' },
  { id: 'app-edit-history', audience: 'app', text: 'Deleted an article or NPC by mistake? World Manager > Recently edited lists every change, and Restore brings the entry back.' },
  { id: 'app-npc-from-monster', audience: 'app', text: 'Building an NPC? You can base its stat block on an existing monster from the Compendium instead of starting blank.' },
  { id: 'app-faction-graph', audience: 'app', text: 'Switch Factions to the diplomacy graph view to see alliances and rivalries at a glance instead of a plain list.' },
  { id: 'app-quests-factions', audience: 'app', text: 'Link a quest to a faction and it shows up automatically wherever that faction is referenced.' },
  { id: 'app-place-builder', audience: 'app', text: 'Building a town or dungeon? The Place Builder above the Places table walks you through it and files the result as a World Manager entry.' },
  { id: 'app-mentions', audience: 'app', text: 'Type @ in session chat to mention an NPC, creature or spell - the mention links straight to its entry.' },

  // ---- Battle maps ----
  { id: 'app-map-sidebar-tokens', audience: 'app', text: 'On a battle map, open Tokens in the right sidebar and drag a creature, library token or encounter monster straight onto the grid.' },
  { id: 'app-map-right-click-token', audience: 'app', text: 'Right-click a token on the map to open its row under Tokens > On map, where you rename it and edit its notes, HP and size.' },
  { id: 'app-map-right-click-canvas', audience: 'app', text: 'Right-click an empty part of the map for grid on/off, square size, square or hex grid, flip and rotate.' },
  { id: 'app-map-sidebar-toggle', audience: 'app', text: 'Press B on a battle map to fold the right sidebar away, and again to bring it back. Drag its edge to make it wider.' },
  { id: 'app-map-reset-view', audience: 'app', text: 'Lost after zooming around a map? Reset view in the bottom toolbar fits the whole map back onto your screen.' },
  { id: 'app-map-fullscreen', audience: 'app', text: 'Press F11 on a map for true fullscreen - the browser tabs and taskbar disappear so the table only sees the battlefield.' },
  { id: 'app-map-grid-tokens', audience: 'app', text: 'Tokens are sized in grid squares, so changing the square size rescales every token on the map to match.' },
  { id: 'app-map-floors', audience: 'app', text: 'Multi-level dungeon? Add floors to one map and switch between them from Floors in the map sidebar.' },
  { id: 'app-encounter-lock', audience: 'app', text: 'Lock an encounter to a floor from the Encounters tab of the Tokens panel so its roster is ready to drop on that floor.' },
  { id: 'app-fog-of-war', audience: 'app', text: 'Turn on fog of war from the cloud button: tokens reveal what they can see, and walls block line of sight.' },
  { id: 'app-fog-detect-walls', audience: 'app', text: 'Detect walls in the fog panel traces walls from the map image for you - then fix what it missed with Draw and Erase.' },
  { id: 'app-fog-turn', audience: 'app', text: "During combat the fog shows only the acting creature's line of sight, so you see exactly what it can see on its turn." },
  { id: 'app-fog-preview', audience: 'app', text: 'Wonder what the players would see? "Preview as players see it" in the fog panel makes the fog fully opaque.' },

  // ---- Combat ----
  { id: 'app-initiative-roll', audience: 'app', text: 'Initiative > Roll Initiative rolls d20 + DEX for every token on the floor. Fix any roll, then Start Encounter locks the order.' },
  { id: 'app-initiative-change', audience: 'app', text: 'Need to change an initiative mid-fight? Right-click the combatant in the Initiative list and choose Change initiative.' },
  { id: 'app-effect-icons', audience: 'app', text: 'Add conditions like Poisoned or Prone to a combatant and an icon appears on its portrait in the initiative bar - no more forgotten effects.' },
  { id: 'app-combat-hotkeys', audience: 'app', text: 'Select a token and press T to apply damage, L to heal, or N to end the turn. Press ? to see and rebind every shortcut.' },
  { id: 'app-multi-select', audience: 'app', text: 'Ctrl+click several tokens, then apply damage once - a fireball hits the whole group in a single undoable step.' },
  { id: 'app-temp-hp', audience: 'app', text: 'Temporary HP soaks damage first, just like the rules say - Alt+T gives it to the selected combatants.' },
  { id: 'app-dice', audience: 'app', text: 'Press D on a map to open the dice panel. Rolls land as real 3D dice, and your roll history stays in the panel.' },
  { id: 'app-clean-encounter', audience: 'app', text: 'Clean Encounter clears every token at 0 HP off the map in one go, and takes their initiative rows with them.' },
  { id: 'app-stat-block', audience: 'app', text: "Double-click a token to open its creature's stat block in the map's Reference panel while the map stays live." },

  // ---- Play session & prep tools ----
  { id: 'app-play-layouts', audience: 'app', text: 'The Play page has six layouts. Split any pane to make your own, and drag one pane header onto another to swap them.' },
  { id: 'app-play-items', audience: 'app', text: 'Items windows learn what you use: the stat blocks, tables and encounters you open most rise to the top of each list.' },
  { id: 'app-random-tables', audience: 'app', text: 'Tag random tables with things like env:forest or tier:1, then filter by tag to find the right table mid-session.' },
  { id: 'app-encounters-tables', audience: 'app', text: 'Group encounters into a random encounter table so the Play page can roll one for you mid-session.' },
  { id: 'app-notes-canvas', audience: 'app', text: 'DM Notes can be a free-form canvas, not just a page - pin ideas, draw connections, and rearrange your prep visually.' },

  // ---- DM craft ----
  { id: 'dm-secret-notes', audience: 'dm', text: "Keep a running notes page for secrets your players haven't discovered yet - future you will thank present you." },
  { id: 'dm-prep-encounters', audience: 'dm', text: 'Pre-build encounters before a dungeon crawl so you can drop them onto the map without breaking pace.' },
  { id: 'dm-bastion-facilities', audience: 'dm', text: "Track each player character's Bastion facilities so downtime upgrades do not get forgotten between sessions." },
  { id: 'dm-faction-motives', audience: 'dm', text: 'Give every major faction one concrete short-term goal - it makes improvising their next move much easier.' },
  { id: 'dm-foreshadow', audience: 'dm', text: 'Drop one small clue about your next plot beat into an NPC conversation at least a session before it matters.' },
  { id: 'dm-three-clues', audience: 'dm', text: 'For any conclusion you need the party to reach, plant at least three clues - they will miss at least one.' },
  { id: 'dm-strong-start', audience: 'dm', text: 'Open each session in the middle of something happening. Recaps go down easier once the dice are already rolling.' },
  { id: 'dm-npc-voice', audience: 'dm', text: "Give recurring NPCs one memorable trait - a phrase, a habit, a smell - and write it into their personality list." },
  { id: 'dm-monster-morale', audience: 'dm', text: 'Most monsters want to live. Having them flee or surrender at half HP makes fights feel real, and shorter.' },
  { id: 'dm-session-end', audience: 'dm', text: 'End on a question, not a conclusion - a cliffhanger keeps the table talking until next session.' },
  { id: 'dm-random-tables', audience: 'dm', text: 'Roll on a random table when you are stuck, then decide why that result makes sense - it beats freezing up.' },
  { id: 'dm-safety', audience: 'dm', text: 'Talk about lines and veils in session zero. A two-minute conversation saves a lot of awkward ones later.' },

  // ---- Player craft ----
  { id: 'player-note-npcs', audience: 'player', text: "Jot down the names of NPCs you meet - the DM's world is bigger than what fits in one session of notes." },
  { id: 'player-read-handouts', audience: 'player', text: "Re-read published articles about your character's homeland before a session set there - small details make great roleplay hooks." },
  { id: 'player-ask-motivation', audience: 'player', text: "If your character's motivation feels stale, ask your DM for a personal quest hook tied to their backstory." },
  { id: 'player-bastion-downtime', audience: 'player', text: 'Spend downtime on your Bastion between adventures - facilities compound in usefulness the earlier you invest.' },
  { id: 'player-plan-turn', audience: 'player', text: 'Plan your turn while others take theirs - combat moves faster and everyone gets more turns.' },
  { id: 'player-help-action', audience: 'player', text: 'Nothing useful to do this turn? The Help action gives an ally advantage - it is rarely a wasted turn.' },
  { id: 'player-ask-senses', audience: 'player', text: 'Ask what your character hears and smells, not just what they see. DMs often hide their best details there.' },
  { id: 'player-spotlight', audience: 'player', text: "Hand the spotlight to a quieter player now and then - asking their character a question in-game works wonders." },
];
