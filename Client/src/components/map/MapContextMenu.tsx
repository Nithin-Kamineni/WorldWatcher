import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CheckIcon from '@mui/icons-material/Check';
import GridOnIcon from '@mui/icons-material/GridOn';
import GridOffIcon from '@mui/icons-material/GridOff';
import FlipIcon from '@mui/icons-material/Flip';
import Rotate90DegreesCwIcon from '@mui/icons-material/Rotate90DegreesCw';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { GridType } from '../../types/map';
import { GRID_SIZE_MAX, GRID_SIZE_MIN } from '../../types/map';

const GRID_COLOR_PRESETS = ['rgba(128,128,128,0.35)', '#ffffff', '#000000', '#f5c542', '#3b82f6'];

interface MapContextMenuProps {
  /** Viewport position to open at - the right-click point, or the toolbar's "more" button. */
  anchorPosition: { top: number; left: number } | null;
  onClose: () => void;
  gridEnabled: boolean;
  gridSize: number;
  gridColor: string;
  gridThickness: number;
  gridType: GridType;
  onToggleGrid: () => void;
  onGridSizeChange: (size: number) => void;
  /** Slider released - tokens rescale to the new square once, here, not per tick. */
  onGridSizeCommit: (size: number) => void;
  onGridColorChange: (color: string) => void;
  onGridThicknessChange: (thickness: number) => void;
  onGridTypeChange: (type: GridType) => void;
  flippedHorizontal: boolean;
  flippedVertical: boolean;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onRotate: () => void;
  onResetView: () => void;
}

/**
 * The map's own right-click menu, in place of the browser's. It holds the settings a DM
 * sets once per map and then leaves alone - grid, grid style, flip, rotate - which used to
 * take up a third of the bottom toolbar. A Popover rather than a Menu because it carries
 * sliders, and Menu's arrow-key navigation would fight a focused slider for the same keys.
 * Toggles leave it open so several can be changed in one visit; one-shot actions close it.
 */
export function MapContextMenu({
  anchorPosition,
  onClose,
  gridEnabled,
  gridSize,
  gridColor,
  gridThickness,
  gridType,
  onToggleGrid,
  onGridSizeChange,
  onGridSizeCommit,
  onGridColorChange,
  onGridThicknessChange,
  onGridTypeChange,
  flippedHorizontal,
  flippedVertical,
  onFlipHorizontal,
  onFlipVertical,
  onRotate,
  onResetView,
}: MapContextMenuProps) {
  // A map saved before the range was cut 4x can still hold a size above the new maximum;
  // the slider pins to its end rather than rendering off the rail.
  const sliderValue = Math.min(GRID_SIZE_MAX, Math.max(GRID_SIZE_MIN, gridSize));

  return (
    <Popover
      open={!!anchorPosition}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition ?? undefined}
      // A second right-click while it is open closes it instead of opening the browser's menu.
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
      slotProps={{ paper: { sx: { width: 260 } } }}
    >
      <MenuList dense sx={{ pb: 0 }}>
        <MenuItem onClick={onToggleGrid}>
          <ListItemIcon>{gridEnabled ? <GridOnIcon fontSize="small" /> : <GridOffIcon fontSize="small" />}</ListItemIcon>
          <ListItemText>Show grid</ListItemText>
          {gridEnabled && <CheckIcon fontSize="small" color="primary" />}
        </MenuItem>
      </MenuList>

      {gridEnabled && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Square size: {gridSize}px
          </Typography>
          <Slider
            size="small"
            value={sliderValue}
            min={GRID_SIZE_MIN}
            max={GRID_SIZE_MAX}
            step={1}
            onChange={(_e, value) => onGridSizeChange(value as number)}
            onChangeCommitted={(_e, value) => onGridSizeCommit(value as number)}
          />

          <Typography variant="caption" color="text.secondary">
            Grid style
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={gridType}
            onChange={(_e, value) => value && onGridTypeChange(value)}
            fullWidth
            sx={{ mt: 0.5, mb: 1 }}
          >
            <ToggleButton value="square">Square</ToggleButton>
            <ToggleButton value="hex">Hex</ToggleButton>
          </ToggleButtonGroup>

          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            {GRID_COLOR_PRESETS.map((color) => (
              <Box
                key={color}
                onClick={() => onGridColorChange(color)}
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  bgcolor: color,
                  cursor: 'pointer',
                  border: gridColor === color ? '2px solid' : '1px solid rgba(0,0,0,0.2)',
                  borderColor: gridColor === color ? 'text.primary' : undefined,
                }}
              />
            ))}
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Line thickness: {gridThickness}px
          </Typography>
          <Slider
            size="small"
            value={gridThickness}
            min={1}
            max={6}
            step={1}
            onChange={(_e, value) => onGridThicknessChange(value as number)}
          />
        </Box>
      )}

      <Divider />

      <MenuList dense>
        <MenuItem onClick={onFlipHorizontal}>
          <ListItemIcon>
            <FlipIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Flip horizontal</ListItemText>
          {flippedHorizontal && <CheckIcon fontSize="small" color="primary" />}
        </MenuItem>
        <MenuItem onClick={onFlipVertical}>
          <ListItemIcon>
            <FlipIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
          </ListItemIcon>
          <ListItemText>Flip vertical</ListItemText>
          {flippedVertical && <CheckIcon fontSize="small" color="primary" />}
        </MenuItem>
        <MenuItem onClick={onRotate}>
          <ListItemIcon>
            <Rotate90DegreesCwIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rotate 90°</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            onResetView();
            onClose();
          }}
        >
          <ListItemIcon>
            <RestartAltIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reset view</ListItemText>
        </MenuItem>
      </MenuList>
    </Popover>
  );
}
