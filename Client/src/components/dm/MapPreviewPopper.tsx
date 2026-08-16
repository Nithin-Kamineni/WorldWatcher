import Popper from '@mui/material/Popper';
import Fade from '@mui/material/Fade';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { MapFloor } from '../../types/map';

interface MapPreviewPopperProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  mapName: string;
  floors: MapFloor[];
  primaryFloorId: string;
}

export function MapPreviewPopper({ open, anchorEl, mapName, floors, primaryFloorId }: MapPreviewPopperProps) {
  const primaryFloor = floors.find((f) => f.id === primaryFloorId) ?? floors[0];
  if (!primaryFloor) return null;

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
              width: 260,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }} noWrap>
              {mapName}
            </Typography>
            <Box
              component="img"
              src={primaryFloor.imageSrc}
              alt={primaryFloor.name}
              sx={{
                width: '100%',
                aspectRatio: '16 / 10',
                objectFit: 'cover',
                borderRadius: 2,
                display: 'block',
              }}
            />
            {floors.length > 1 && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, overflowX: 'auto', pb: 0.5 }}>
                {floors.map((floor) => (
                  <Stack key={floor.id} spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
                    <Box
                      component="img"
                      src={floor.imageSrc}
                      alt={floor.name}
                      sx={{
                        width: 52,
                        height: 52,
                        objectFit: 'cover',
                        borderRadius: 1.5,
                        border: floor.id === primaryFloorId ? '2px solid' : '1px solid',
                        borderColor: floor.id === primaryFloorId ? 'primary.main' : 'divider',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 56 }}>
                      {floor.name}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        </Fade>
      )}
    </Popper>
  );
}
