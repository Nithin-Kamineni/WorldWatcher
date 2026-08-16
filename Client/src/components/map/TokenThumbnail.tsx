import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';

interface TokenThumbnailProps {
  src: string;
  name: string;
  size: number;
  border?: string;
  sx?: SxProps<Theme>;
}

export function TokenThumbnail({ src, name, size, border, sx }: TokenThumbnailProps) {
  if (src) {
    return (
      <Box
        component="img"
        src={src}
        alt={name}
        sx={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border, flexShrink: 0, ...sx }}
      />
    );
  }
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        border,
        flexShrink: 0,
        bgcolor: 'action.selected',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        ...sx,
      }}
    >
      {name.charAt(0).toUpperCase() || '?'}
    </Box>
  );
}
