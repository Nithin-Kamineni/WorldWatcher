import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import MenuIcon from '@mui/icons-material/Menu';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import CasinoIcon from '@mui/icons-material/Casino';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import HomeIcon from '@mui/icons-material/Home';
import GroupsIcon from '@mui/icons-material/Groups';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import SportsMmaIcon from '@mui/icons-material/SportsMma';
import FavoriteIcon from '@mui/icons-material/Favorite';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import NotesIcon from '@mui/icons-material/Notes';
import CloseIcon from '@mui/icons-material/Close';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import ReplyIcon from '@mui/icons-material/Reply';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ShieldIcon from '@mui/icons-material/Shield';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import TimerIcon from '@mui/icons-material/Timer';
import LinkIcon from '@mui/icons-material/Link';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export type ShortcutCategory = 'encounter' | 'combatant';

export interface ShortcutActionDef {
  id: string;
  category: ShortcutCategory;
  label: string;
  icon: ComponentType<SvgIconProps>;
  /** Normalized default combo, e.g. "alt+shift+i" - see comboFromKeyboardEvent for the format. */
  defaultCombo: string;
  defaultToolbar: boolean;
  /** Combatant rows only - whether it shows inline on the combatant's row by default. */
  defaultInline?: boolean;
  /** Whether MapPage actually has a handler wired up for this action yet. Unwired actions still
   * show up in the settings UI (rebindable, future-proofed) but pressing their hotkey is a no-op
   * and they never appear in the map's ShortcutQuickBar. */
  wired: boolean;
}

// Defaults match the "Improved Initiative" web app's own defaults, as pasted by the user.
export const SHORTCUT_ACTIONS: ShortcutActionDef[] = [
  // ---- Encounter commands ----
  { id: 'toggleWideMenu', category: 'encounter', label: 'Toggle Wide Menu', icon: MenuIcon, defaultCombo: 'alt+m', defaultToolbar: true, wired: false },
  { id: 'startEncounter', category: 'encounter', label: 'Start Encounter', icon: PlayArrowIcon, defaultCombo: 'alt+r', defaultToolbar: false, wired: true },
  { id: 'rerollInitiative', category: 'encounter', label: 'Reroll Initiative', icon: ReplayIcon, defaultCombo: 'alt+shift+i', defaultToolbar: false, wired: true },
  { id: 'endEncounter', category: 'encounter', label: 'End Encounter', icon: StopCircleIcon, defaultCombo: 'alt+shift+r', defaultToolbar: true, wired: true },
  { id: 'clearEncounter', category: 'encounter', label: 'Clear Encounter', icon: DeleteSweepIcon, defaultCombo: 'alt+shift+del', defaultToolbar: false, wired: true },
  { id: 'cleanEncounter', category: 'encounter', label: 'Clean Encounter', icon: CleaningServicesIcon, defaultCombo: 'alt+del', defaultToolbar: true, wired: true },
  { id: 'libraryReferencePane', category: 'encounter', label: 'Library Reference Pane', icon: LibraryBooksIcon, defaultCombo: 'alt+a', defaultToolbar: true, wired: false },
  { id: 'libraryManager', category: 'encounter', label: 'Library Manager', icon: CollectionsBookmarkIcon, defaultCombo: 'alt+shift+a', defaultToolbar: false, wired: false },
  { id: 'rollDice', category: 'encounter', label: 'Roll Dice', icon: CasinoIcon, defaultCombo: 'd', defaultToolbar: false, wired: false },
  { id: 'quickAddCombatant', category: 'encounter', label: 'Quick Add Combatant', icon: PersonAddAlt1Icon, defaultCombo: 'alt+q', defaultToolbar: false, wired: false },
  { id: 'restoreAllPcHp', category: 'encounter', label: 'Restore all Player Character HP', icon: HomeIcon, defaultCombo: 'alt+shift+t', defaultToolbar: false, wired: true },
  { id: 'launchPlayerView', category: 'encounter', label: 'Launch Player View', icon: GroupsIcon, defaultCombo: 'alt+w', defaultToolbar: true, wired: false },
  { id: 'toggleFullScreen', category: 'encounter', label: 'Toggle Full Screen', icon: FullscreenIcon, defaultCombo: 'f11', defaultToolbar: false, wired: true },
  { id: 'nextTurn', category: 'encounter', label: 'Next Turn', icon: SkipNextIcon, defaultCombo: 'n', defaultToolbar: true, wired: true },
  { id: 'previousTurn', category: 'encounter', label: 'Previous Turn', icon: SkipPreviousIcon, defaultCombo: 'alt+n', defaultToolbar: false, wired: true },
  { id: 'saveEncounter', category: 'encounter', label: 'Save Encounter', icon: SaveIcon, defaultCombo: 'alt+s', defaultToolbar: true, wired: true },
  { id: 'openSettings', category: 'encounter', label: 'Settings', icon: SettingsIcon, defaultCombo: '?', defaultToolbar: true, wired: true },

  // ---- Combatant commands ----
  { id: 'applyDamage', category: 'combatant', label: 'Apply Damage', icon: SportsMmaIcon, defaultCombo: 't', defaultToolbar: true, defaultInline: false, wired: true },
  { id: 'applyHealing', category: 'combatant', label: 'Apply Healing', icon: FavoriteIcon, defaultCombo: 'l', defaultToolbar: false, defaultInline: false, wired: true },
  { id: 'applyTempHp', category: 'combatant', label: 'Apply Temporary HP', icon: MedicalServicesIcon, defaultCombo: 'alt+t', defaultToolbar: false, defaultInline: false, wired: true },
  { id: 'addTag', category: 'combatant', label: 'Add Tag', icon: LocalOfferIcon, defaultCombo: 'g', defaultToolbar: false, defaultInline: true, wired: true },
  { id: 'updatePersistentNotes', category: 'combatant', label: 'Update Persistent Notes', icon: NotesIcon, defaultCombo: 'y', defaultToolbar: false, defaultInline: false, wired: true },
  { id: 'removeFromEncounter', category: 'combatant', label: 'Remove from Encounter', icon: CloseIcon, defaultCombo: 'del', defaultToolbar: true, defaultInline: false, wired: true },
  { id: 'rename', category: 'combatant', label: 'Rename', icon: DriveFileRenameOutlineIcon, defaultCombo: 'f2', defaultToolbar: true, defaultInline: false, wired: true },
  { id: 'toggleSpentReaction', category: 'combatant', label: 'Toggle Spent Reaction', icon: ReplyIcon, defaultCombo: 'r', defaultToolbar: false, defaultInline: false, wired: true },
  { id: 'hideRevealInPlayerView', category: 'combatant', label: 'Hide/Reveal in Player View', icon: VisibilityIcon, defaultCombo: 'h', defaultToolbar: false, defaultInline: true, wired: false },
  { id: 'revealHideAcInPlayerView', category: 'combatant', label: 'Reveal/Hide AC in Player View', icon: ShieldIcon, defaultCombo: 'alt+h', defaultToolbar: false, defaultInline: false, wired: false },
  { id: 'editUniqueStatblock', category: 'combatant', label: 'Edit Unique Statblock', icon: EditNoteIcon, defaultCombo: 'shift+e', defaultToolbar: false, defaultInline: false, wired: false },
  { id: 'quickEditCombatant', category: 'combatant', label: 'Quick Edit Combatant', icon: AutoFixHighIcon, defaultCombo: 'e', defaultToolbar: true, defaultInline: false, wired: true },
  { id: 'editInitiative', category: 'combatant', label: 'Edit Initiative', icon: TimerIcon, defaultCombo: 'alt+i', defaultToolbar: false, defaultInline: false, wired: false },
  { id: 'linkInitiative', category: 'combatant', label: 'Link Initiative', icon: LinkIcon, defaultCombo: 'alt+l', defaultToolbar: false, defaultInline: false, wired: false },
  { id: 'moveDown', category: 'combatant', label: 'Move Down', icon: KeyboardDoubleArrowDownIcon, defaultCombo: 'alt+j', defaultToolbar: true, defaultInline: false, wired: false },
  { id: 'moveUp', category: 'combatant', label: 'Move Up', icon: KeyboardDoubleArrowUpIcon, defaultCombo: 'alt+k', defaultToolbar: true, defaultInline: false, wired: false },
  { id: 'selectNext', category: 'combatant', label: 'Select Next', icon: ArrowDownwardIcon, defaultCombo: 'j', defaultToolbar: false, defaultInline: false, wired: true },
  { id: 'selectPrevious', category: 'combatant', label: 'Select Previous', icon: ArrowUpwardIcon, defaultCombo: 'k', defaultToolbar: false, defaultInline: false, wired: true },
  { id: 'duplicateCombatant', category: 'combatant', label: 'Duplicate Combatant', icon: ContentCopyIcon, defaultCombo: 'alt+d', defaultToolbar: false, defaultInline: false, wired: true },
];

export const SHORTCUT_ACTIONS_BY_ID: Record<string, ShortcutActionDef> = Object.fromEntries(
  SHORTCUT_ACTIONS.map((a) => [a.id, a]),
);

/** True for a single printable symbol that already unambiguously implies Shift on a US layout
 * (e.g. "?" from Shift+/) - for those we don't also record an explicit shift+ prefix, matching
 * how Improved Initiative documents its own "?" Settings shortcut. Letters/digits and named keys
 * (Delete, F2, ...) still get an explicit shift+ prefix since their glyph doesn't encode it. */
function isSelfShiftedSymbol(key: string): boolean {
  return key.length === 1 && !/[a-zA-Z0-9]/.test(key);
}

function normalizeKeyName(key: string): string {
  switch (key) {
    case ' ':
      return 'space';
    case 'Delete':
      return 'del';
    case 'Escape':
      return 'esc';
    default:
      return key.toLowerCase();
  }
}

/** Normalizes a KeyboardEvent into the same "ctrl+alt+shift+meta+key" combo string format used
 * by ShortcutActionDef.defaultCombo, so pressed keys can be looked up directly against it. */
export function comboFromKeyboardEvent(e: KeyboardEvent | React.KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey && !isSelfShiftedSymbol(e.key)) parts.push('shift');
  if (e.metaKey) parts.push('meta');
  const key = normalizeKeyName(e.key);
  if (['control', 'alt', 'shift', 'meta'].includes(key)) return parts.join('+');
  parts.push(key);
  return parts.join('+');
}

const KEY_DISPLAY_NAMES: Record<string, string> = {
  del: 'Delete',
  esc: 'Esc',
  space: 'Space',
};

/** Renders a normalized combo string back into a human-readable label, e.g. "alt+shift+i" ->
 * "Alt+Shift+I". Symbol keys and short named keys are displayed as-is/mapped. */
export function formatCombo(combo: string): string {
  return combo
    .split('+')
    .map((part) => {
      if (part.length === 0) return part;
      if (KEY_DISPLAY_NAMES[part]) return KEY_DISPLAY_NAMES[part];
      if (part.length === 1 && !/[a-z0-9]/.test(part)) return part;
      return part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('+');
}
