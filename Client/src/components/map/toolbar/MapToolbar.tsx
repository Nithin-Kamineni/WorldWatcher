import { useRef, useState, type ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Slider from '@mui/material/Slider';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import GridOnIcon from '@mui/icons-material/GridOn';
import GridOffIcon from '@mui/icons-material/GridOff';
import TuneIcon from '@mui/icons-material/Tune';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CategoryIcon from '@mui/icons-material/Category';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import Crop169Icon from '@mui/icons-material/Crop169';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import GestureIcon from '@mui/icons-material/Gesture';
import AutoFixNormalIcon from '@mui/icons-material/AutoFixNormal';
import StraightenIcon from '@mui/icons-material/Straighten';
import FlipIcon from '@mui/icons-material/Flip';
import Rotate90DegreesCwIcon from '@mui/icons-material/Rotate90DegreesCw';
import NearMeIcon from '@mui/icons-material/NearMe';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import CasinoIcon from '@mui/icons-material/Casino';
import GroupsIcon from '@mui/icons-material/Groups';
import { DiceRollerPopover } from './DiceRollerPopover';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import type { MapToolMode } from '../../../types/tool';
import { AOE_COLOR_PRESETS, MAX_MARKER_WIDTH, MIN_MARKER_WIDTH } from '../../../types/shape';
import type { GridType } from '../../../types/map';

interface MapToolbarProps {
  gridEnabled: boolean;
  gridSize: number;
  gridColor: string;
  gridThickness: number;
  gridType: GridType;
  onToggleGrid: () => void;
  onGridSizeChange: (size: number) => void;
  onGridColorChange: (color: string) => void;
  onGridThicknessChange: (thickness: number) => void;
  onGridTypeChange: (type: GridType) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  activeTool: MapToolMode;
  onSelectTool: (tool: MapToolMode) => void;
  shapeColor: string;
  onShapeColorChange: (color: string) => void;
  markerWidth: number;
  onMarkerWidthChange: (width: number) => void;
  flippedHorizontal: boolean;
  flippedVertical: boolean;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onRotate: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenTokenManager: (anchorEl: HTMLElement) => void;
}

const SHAPE_TOOLS: { tool: MapToolMode; label: string; icon: ReactNode }[] = [
  { tool: 'aoe-circle', label: 'Circle area of effect', icon: <CircleOutlinedIcon fontSize="small" /> },
  { tool: 'aoe-cone', label: 'Cone area of effect', icon: <ChangeHistoryIcon fontSize="small" /> },
  { tool: 'aoe-square', label: 'Square area of effect', icon: <CheckBoxOutlineBlankIcon fontSize="small" /> },
  { tool: 'aoe-rectangle', label: 'Rectangle area of effect', icon: <Crop169Icon fontSize="small" /> },
  { tool: 'aoe-line', label: 'Line', icon: <HorizontalRuleIcon fontSize="small" /> },
  { tool: 'aoe-line-thin', label: 'Thin line (3px)', icon: <DragHandleIcon fontSize="small" /> },
  { tool: 'marker', label: 'Marker (freehand)', icon: <GestureIcon fontSize="small" /> },
  { tool: 'eraser', label: 'Eraser', icon: <AutoFixNormalIcon fontSize="small" /> },
];

const toolbarSx = {
  borderRadius: 3,
  px: 1.5,
  py: 1,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 0.5,
  pointerEvents: 'auto',
  bgcolor: 'rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(2px)',
  '& .MuiIconButton-root': { color: 'common.white' },
  '& .MuiIconButton-root.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
  '& .MuiSlider-root': { color: 'primary.main' },
  '& .MuiSlider-rail': { color: 'rgba(255,255,255,0.3)' },
} as const;

function shapeIconFor(tool: MapToolMode) {
  return SHAPE_TOOLS.find((s) => s.tool === tool)?.icon ?? <CategoryIcon fontSize="small" />;
}

export function MapToolbar({
  gridEnabled,
  gridSize,
  gridColor,
  gridThickness,
  gridType,
  onToggleGrid,
  onGridSizeChange,
  onGridColorChange,
  onGridThicknessChange,
  onGridTypeChange,
  onZoomIn,
  onZoomOut,
  onResetView,
  activeTool,
  onSelectTool,
  shapeColor,
  onShapeColorChange,
  markerWidth,
  onMarkerWidthChange,
  flippedHorizontal,
  flippedVertical,
  onFlipHorizontal,
  onFlipVertical,
  onRotate,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenTokenManager,
}: MapToolbarProps) {
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [shapesAnchor, setShapesAnchor] = useState<HTMLElement | null>(null);
  const [gridAnchor, setGridAnchor] = useState<HTMLElement | null>(null);
  const [diceAnchor, setDiceAnchor] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const tokenManagerButtonRef = useRef<HTMLButtonElement>(null);

  const handleToolClick = (tool: MapToolMode) => {
    onSelectTool(activeTool === tool ? 'select' : tool);
  };

  const handleCollapseToggle = () => {
    setColorAnchor(null);
    setShapesAnchor(null);
    setGridAnchor(null);
    setDiceAnchor(null);
    setCollapsed((c) => !c);
  };

  const isShapeToolActive = SHAPE_TOOLS.some((s) => s.tool === activeTool);

  if (collapsed) {
    return (
      <Paper elevation={4} sx={toolbarSx}>
        <Tooltip title="Expand toolbar">
          <IconButton size="small" onClick={handleCollapseToggle}>
            <UnfoldMoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>
    );
  }

  return (
    <Paper elevation={4} sx={toolbarSx}>
      <Tooltip title="Pointer">
        <IconButton
          size="small"
          color={activeTool === 'select' ? 'primary' : 'default'}
          onClick={() => onSelectTool('select')}
        >
          <NearMeIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Undo (Ctrl+Z)">
        <span>
          <IconButton size="small" onClick={onUndo} disabled={!canUndo}>
            <UndoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Redo (Ctrl+Y)">
        <span>
          <IconButton size="small" onClick={onRedo} disabled={!canRedo}>
            <RedoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.3)' }} />

      <Tooltip title={gridEnabled ? 'Disable grid' : 'Enable grid'}>
        <IconButton size="small" color={gridEnabled ? 'primary' : 'default'} onClick={onToggleGrid}>
          {gridEnabled ? <GridOnIcon fontSize="small" /> : <GridOffIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      {gridEnabled && (
        <>
          <Slider
            size="small"
            value={gridSize}
            min={20}
            max={200}
            step={5}
            onChange={(_e, value) => onGridSizeChange(value as number)}
            sx={{ width: 100, mx: 1 }}
          />
          <Tooltip title="Grid style">
            <IconButton size="small" onClick={(e) => setGridAnchor(e.currentTarget)}>
              <TuneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.3)' }} />

      <Tooltip title="Zoom in">
        <IconButton size="small" onClick={onZoomIn}>
          <ZoomInIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Zoom out">
        <IconButton size="small" onClick={onZoomOut}>
          <ZoomOutIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Reset view">
        <IconButton size="small" onClick={onResetView}>
          <RestartAltIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.3)' }} />

      <Tooltip title="Shapes, marker & eraser">
        <IconButton
          size="small"
          color={isShapeToolActive ? 'primary' : 'default'}
          onClick={(e) => setShapesAnchor(e.currentTarget)}
        >
          {shapeIconFor(activeTool)}
        </IconButton>
      </Tooltip>
      <Tooltip title="Ruler">
        <IconButton
          size="small"
          color={activeTool === 'ruler' ? 'primary' : 'default'}
          onClick={() => handleToolClick('ruler')}
        >
          <StraightenIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Shape / marker color">
        <IconButton size="small" onClick={(e) => setColorAnchor(e.currentTarget)}>
          <Box
            sx={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              bgcolor: shapeColor,
              border: '1px solid rgba(255,255,255,0.4)',
            }}
          />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.3)' }} />

      <Tooltip title="Flip horizontal">
        <IconButton size="small" color={flippedHorizontal ? 'primary' : 'default'} onClick={onFlipHorizontal}>
          <FlipIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Flip vertical">
        <IconButton size="small" color={flippedVertical ? 'primary' : 'default'} onClick={onFlipVertical}>
          <FlipIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Rotate 90°">
        <IconButton size="small" onClick={onRotate}>
          <Rotate90DegreesCwIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.3)' }} />

      <Tooltip title="Manage tokens">
        <IconButton
          ref={tokenManagerButtonRef}
          size="small"
          onClick={() => tokenManagerButtonRef.current && onOpenTokenManager(tokenManagerButtonRef.current)}
        >
          <GroupsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Roll dice">
        <IconButton size="small" onClick={(e) => setDiceAnchor(e.currentTarget)}>
          <CasinoIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.3)' }} />

      <Tooltip title="Collapse toolbar">
        <IconButton size="small" onClick={handleCollapseToggle}>
          <UnfoldLessIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={!!shapesAnchor}
        anchorEl={shapesAnchor}
        onClose={() => setShapesAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Stack sx={{ p: 1, width: 220 }} spacing={0.5}>
          {SHAPE_TOOLS.map(({ tool, label, icon }) => (
            <Stack
              key={tool}
              direction="row"
              spacing={1.5}
              onClick={() => {
                handleToolClick(tool);
                setShapesAnchor(null);
              }}
              sx={{
                alignItems: 'center',
                p: 1,
                borderRadius: 2,
                cursor: 'pointer',
                bgcolor: activeTool === tool ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {icon}
              <Typography variant="body2">{label}</Typography>
            </Stack>
          ))}
        </Stack>
      </Popover>

      <Popover
        open={!!colorAnchor}
        anchorEl={colorAnchor}
        onClose={() => setColorAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Box sx={{ p: 1.5, width: 200 }}>
          <Typography variant="caption" color="text.secondary">
            Shape / marker color
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 1.5 }}>
            {AOE_COLOR_PRESETS.map((color) => (
              <Box
                key={color}
                onClick={() => onShapeColorChange(color)}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: color,
                  cursor: 'pointer',
                  border: shapeColor === color ? '2px solid' : '1px solid rgba(0,0,0,0.2)',
                  borderColor: shapeColor === color ? 'text.primary' : undefined,
                }}
              />
            ))}
          </Stack>
          <input
            type="color"
            value={shapeColor}
            onChange={(e) => onShapeColorChange(e.target.value)}
            style={{ width: '100%', height: 32, border: 'none', background: 'none', cursor: 'pointer' }}
          />
          {activeTool === 'marker' && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Marker thickness: {markerWidth}px
              </Typography>
              <Slider
                size="small"
                value={markerWidth}
                min={MIN_MARKER_WIDTH}
                max={MAX_MARKER_WIDTH}
                onChange={(_e, value) => onMarkerWidthChange(value as number)}
              />
            </Box>
          )}
        </Box>
      </Popover>

      <Popover
        open={!!gridAnchor}
        anchorEl={gridAnchor}
        onClose={() => setGridAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Box sx={{ p: 1.5, width: 220 }}>
          <Typography variant="caption" color="text.secondary">
            Grid type
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={gridType}
            onChange={(_e, value) => value && onGridTypeChange(value)}
            fullWidth
            sx={{ mt: 0.5, mb: 1.5 }}
          >
            <ToggleButton value="square">Square</ToggleButton>
            <ToggleButton value="hex">Hex</ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="caption" color="text.secondary">
            Grid color
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 1.5 }}>
            {['rgba(128,128,128,0.35)', '#ffffff', '#000000', '#f5c542', '#3b82f6'].map((color) => (
              <Box
                key={color}
                onClick={() => onGridColorChange(color)}
                sx={{
                  width: 24,
                  height: 24,
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
            Grid thickness: {gridThickness}px
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
      </Popover>

      <DiceRollerPopover anchorEl={diceAnchor} onClose={() => setDiceAnchor(null)} />
    </Paper>
  );
}
