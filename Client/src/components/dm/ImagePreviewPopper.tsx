import Popper from '@mui/material/Popper';
import Fade from '@mui/material/Fade';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface ImagePreviewPopperProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  name: string;
  imageSrc: string;
}

/** Hover-to-enlarge preview for a single image + name - generalized from
 * MapPreviewPopper's Popper/Fade/Paper/img pattern for reuse across the
 * Spells and Magic Items tables. */
export function ImagePreviewPopper({ open, anchorEl, name, imageSrc }: ImagePreviewPopperProps) {
  if (!imageSrc) return null;

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement="right-start"
      transition
      disablePortal={false}
      sx={{ zIndex: (theme) => theme.zIndex.tooltip, pointerEvents: 'none' }}
      modifiers={[{ name: 'offset', options: { offset: [0, 12] } }]}
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={150}>
          <Paper
            elevation={8}
            sx={{
              p: 1.5,
              borderRadius: 3,
              width: 220,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }} noWrap>
              {name}
            </Typography>
            <Box
              component="img"
              src={imageSrc}
              alt={name}
              sx={{
                width: '100%',
                aspectRatio: '1 / 1',
                objectFit: 'contain',
                borderRadius: 2,
                display: 'block',
                bgcolor: 'action.hover',
              }}
            />
          </Paper>
        </Fade>
      )}
    </Popper>
  );
}
