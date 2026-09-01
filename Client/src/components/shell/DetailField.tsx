import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface DetailFieldProps {
  label: string;
  value: ReactNode;
}

/** Small {label, value} row used to build every page's right-panel content
 * consistently without a shared entity data model. */
export function DetailField({ label, value }: DetailFieldProps) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Typography>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Typography variant="body2">{value}</Typography>
      ) : (
        value
      )}
    </Box>
  );
}
