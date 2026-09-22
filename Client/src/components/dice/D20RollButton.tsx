import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { D20Glyph } from './D20Glyph';
import { useDiceRollStore } from '../../store/useDiceRollStore';
import { su } from '../../theme/uiScale';

/** Throws a d20 across the screen (DiceRollOverlay does the throwing). Press it again while
 * dice are still up and another one follows, a beat behind - the store handles the stagger.
 *
 * `data-dice-roll-trigger` is load-bearing, not a test hook: the overlay dismisses every die
 * on any pointerdown anywhere, and this is how it tells "the DM clicked something" apart from
 * "the DM asked for another die". */
export function D20RollButton() {
  const roll = useDiceRollStore((s) => s.roll);

  return (
    <Tooltip title="Roll a d20">
      <IconButton
        data-dice-roll-trigger=""
        size="small"
        aria-label="Roll a d20"
        onClick={() => roll()}
        sx={{
          flexShrink: 0,
          color: 'primary.main',
          transition: 'transform 90ms ease-out',
          '&:active': { transform: 'scale(0.88) rotate(-12deg)' },
        }}
      >
        <D20Glyph size={su(22)} />
      </IconButton>
    </Tooltip>
  );
}
