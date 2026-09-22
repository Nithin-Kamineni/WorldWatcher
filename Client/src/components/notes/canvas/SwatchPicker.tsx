import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import { CANVAS_SWATCHES } from '../../../types/noteCanvas';

/** The colour row used by both editors' selection toolbars. */
export function SwatchPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      {CANVAS_SWATCHES.map((swatch) => (
        <Tooltip key={swatch.id} title={swatch.label}>
          <Box
            component="button"
            type="button"
            aria-label={swatch.label}
            aria-pressed={value === swatch.id}
            onClick={() => onChange(swatch.id)}
            sx={(theme) => ({
              width: 20,
              height: 20,
              p: 0,
              borderRadius: '50%',
              cursor: 'pointer',
              bgcolor: theme.palette.mode === 'dark' ? swatch.dark : swatch.light,
              border: 2,
              borderColor: value === swatch.id ? swatch.accent : 'transparent',
              outline: value === swatch.id ? 'none' : `1px solid ${theme.palette.divider}`,
            })}
          />
        </Tooltip>
      ))}
    </Stack>
  );
}
