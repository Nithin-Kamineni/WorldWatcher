import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import CasinoIcon from '@mui/icons-material/Casino';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import { SectionHeader } from '../shell/SectionHeader';
import { DIE_SIDES, diceNotation, useDiceRollStore, type DiceGroupResult } from '../../store/useDiceRollStore';

const MAX_COUNT = 20;
const MAX_MODIFIER = 30;

function formatModifier(modifier: number): string {
  return modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '';
}

function groupLabel(group: DiceGroupResult): string {
  return `${group.rolls.length}d${group.sides}${formatModifier(group.modifier)}`;
}

function rollTotal(roll: DiceGroupResult[]): number {
  return roll.reduce((sum, g) => sum + g.total, 0);
}

/** "3 + 5 + 1 + 2" - each die as it landed, then the modifier. */
function breakdown(roll: DiceGroupResult[]): string {
  return roll
    .map((g) => {
      const dice = g.rolls.join(' + ');
      if (g.modifier > 0) return `${dice} + ${g.modifier}`;
      if (g.modifier < 0) return `${dice} − ${-g.modifier}`;
      return dice;
    })
    .join(' + ');
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  format = String,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  format?: (value: number) => string;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
        {label}
      </Typography>
      <IconButton size="small" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography variant="body2" sx={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {format(value)}
      </Typography>
      <IconButton size="small" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

/** The dice roller, as a sidebar panel.
 *
 * Every die here is thrown by DiceRollOverlay - the same real 3D physics the top bar's d20
 * uses, not a random number. The panel only asks (`roll(notation, 'fresh')`) and then shows
 * what the simulation reported, from the store's history, which outlives the table being
 * swept on the next click.
 *
 * One click per roll: the count and modifier are set first and stay put, and each die tile
 * throws `{count}d{sides}{modifier}` straight away. At the table "roll 2d6+3" is one tap, and
 * "now a d20" is one tap after setting the count back - there is no separate Roll button to
 * aim for between picking the die and seeing it land.
 *
 * `data-dice-roll-trigger` on the tiles is load-bearing: the overlay sweeps the table on any
 * pointerdown anywhere, and this is how it knows the tile was asking for dice, not away. */
export function DicePanel() {
  const roll = useDiceRollStore((s) => s.roll);
  const history = useDiceRollStore((s) => s.history);
  const clearHistory = useDiceRollStore((s) => s.clearHistory);
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);

  const [latest, ...earlier] = history;

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <SectionHeader
        icon={<CasinoIcon fontSize="small" />}
        title="Dice"
        actions={
          history.length > 0 ? (
            <Tooltip title="Clear roll history">
              <IconButton size="small" aria-label="Clear roll history" onClick={clearHistory}>
                <DeleteSweepOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : undefined
        }
      />

      <Stack sx={{ p: 1.5, gap: 1.5, overflowY: 'auto', minHeight: 0 }}>
        <Box>
          <Stepper label="Number of dice" value={count} onChange={setCount} min={1} max={MAX_COUNT} />
          <Stepper
            label="Modifier"
            value={modifier}
            onChange={setModifier}
            min={-MAX_MODIFIER}
            max={MAX_MODIFIER}
            format={(v) => formatModifier(v) || '0'}
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {DIE_SIDES.map((sides) => {
            const notation = diceNotation(count, sides, modifier);
            return (
              <Tooltip key={sides} title={`Roll ${notation}`}>
                <ButtonBase
                  data-dice-roll-trigger=""
                  aria-label={`Roll ${notation}`}
                  onClick={() => roll(notation, 'fresh')}
                  sx={{
                    flexDirection: 'column',
                    py: 1.25,
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                    transition: 'border-color 120ms ease, background-color 120ms ease, transform 90ms ease-out',
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                    '&:active': { transform: 'scale(0.95)' },
                  }}
                >
                  <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>d{sides}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                    {count > 1 || modifier ? notation : ' '}
                  </Typography>
                </ButtonBase>
              </Tooltip>
            );
          })}
        </Box>

        {latest ? (
          <Box
            sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'primary.main', textAlign: 'center' }}
            aria-live="polite"
          >
            <Typography variant="caption" color="text.secondary">
              {latest.map(groupLabel).join(' + ')}
            </Typography>
            <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
              {rollTotal(latest)}
            </Typography>
            {(latest.length > 1 || latest[0].rolls.length > 1 || latest[0].modifier !== 0) && (
              <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {breakdown(latest)}
              </Typography>
            )}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
            Pick a die to throw it. The number is read off the die that lands.
          </Typography>
        )}

        {earlier.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              Earlier
            </Typography>
            <Stack sx={{ mt: 0.5 }}>
              {earlier.map((entry, i) => (
                <Stack
                  key={i}
                  direction="row"
                  sx={{ alignItems: 'baseline', gap: 1, py: 0.5, borderTop: '1px solid', borderColor: 'divider' }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                    {entry.map(groupLabel).join(' + ')}
                    {entry.length > 1 || entry[0].rolls.length > 1 || entry[0].modifier ? ` · ${breakdown(entry)}` : ''}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {rollTotal(entry)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Stack>
  );
}
