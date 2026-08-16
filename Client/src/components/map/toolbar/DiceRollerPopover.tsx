import { useEffect, useRef, useState } from 'react';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import CasinoIcon from '@mui/icons-material/Casino';
import { rollDice } from '../../../utils/dice';

interface DiceRollerPopoverProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

const DIE_SIDES = [4, 6, 8, 10, 12, 20];
const ROLL_ANIMATION_MS = 700;
const ROLL_TICK_MS = 60;

export function DiceRollerPopover({ anchorEl, onClose }: DiceRollerPopoverProps) {
  const [sides, setSides] = useState(20);
  const [count, setCount] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [displayValues, setDisplayValues] = useState<number[]>([]);
  const [results, setResults] = useState<number[] | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleRoll = () => {
    setResults(null);
    setRolling(true);
    setDisplayValues(rollDice(count, sides));

    intervalRef.current = setInterval(() => {
      setDisplayValues(rollDice(count, sides));
    }, ROLL_TICK_MS);

    setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const finalRolls = rollDice(count, sides);
      setDisplayValues(finalRolls);
      setResults(finalRolls);
      setRolling(false);
    }, ROLL_ANIMATION_MS);
  };

  const total = results ? results.reduce((sum, r) => sum + r, 0) : null;

  return (
    <Popover
      open={!!anchorEl}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Box sx={{ p: 1.5, width: 260 }}>
        <Typography variant="caption" color="text.secondary">
          Die type
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={sides}
          onChange={(_e, value) => value && setSides(value)}
          sx={{ mt: 0.5, mb: 1.5, flexWrap: 'wrap' }}
        >
          {DIE_SIDES.map((s) => (
            <ToggleButton key={s} value={s} sx={{ px: 1.25 }}>
              d{s}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
            Number of dice
          </Typography>
          <IconButton size="small" onClick={() => setCount((c) => Math.max(1, c - 1))}>
            <RemoveIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" sx={{ width: 20, textAlign: 'center' }}>
            {count}
          </Typography>
          <IconButton size="small" onClick={() => setCount((c) => Math.min(20, c + 1))}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Button variant="contained" fullWidth startIcon={<CasinoIcon />} onClick={handleRoll} disabled={rolling}>
          Roll {count}d{sides}
        </Button>

        {displayValues.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {displayValues.map((value, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 14,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: rolling ? 'action.hover' : 'primary.main',
                    color: rolling ? 'text.primary' : 'primary.contrastText',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {value}
                </Box>
              ))}
            </Stack>
            {total !== null && (
              <Typography variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
                Total: {total}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Popover>
  );
}
