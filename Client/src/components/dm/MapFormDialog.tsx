import { useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepButton from '@mui/material/StepButton';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import GridOnIcon from '@mui/icons-material/GridOn';
import HexagonOutlinedIcon from '@mui/icons-material/HexagonOutlined';
import LayersIcon from '@mui/icons-material/Layers';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import MapIcon from '@mui/icons-material/Map';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import PublicIcon from '@mui/icons-material/Public';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import TerrainIcon from '@mui/icons-material/Terrain';
import { isAllowedImageFile } from '../../utils/fileValidation';
import {
  createEmptyFloor,
  DEFAULT_GRID_COLOR,
  DEFAULT_GRID_SIZE,
  DEFAULT_GRID_THICKNESS,
  DEFAULT_GRID_TYPE,
  MAP_KIND_OPTIONS,
  MAP_SETTING_OPTIONS,
  type GridType,
  type MapCustomDetail,
  type MapData,
  type MapFloor,
  type MapKind,
  type MapSetting,
} from '../../types/map';

interface MapFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (map: MapData) => void;
  initialMap?: MapData;
}

/** The four phases, in the order a map actually comes together: say what it is, give it its
 * images, hang the story on it, then set the grid you will be measuring movement against.
 *
 * Phases 1 and 2 carry everything a map cannot exist without (a name, at least one type, at
 * least one floor image); 3 and 4 are optional polish, which is why the stepper is non-linear -
 * an edit that only changes the grid should be two clicks, not a four-screen march. */
const STEPS: { label: string; caption: string; icon: typeof MapIcon }[] = [
  { label: 'Name & type', caption: 'What this map is', icon: MapIcon },
  { label: 'Floors & images', caption: 'One image per floor', icon: LayersIcon },
  { label: 'Story & context', caption: 'Where it sits, what happens', icon: AutoStoriesIcon },
  { label: 'Grid & review', caption: 'Measure, then create', icon: GridOnIcon },
];

const KIND_META: Record<MapKind, { icon: typeof MapIcon; description: string }> = {
  battle: { icon: SportsKabaddiIcon, description: 'Tactical, token-scale. Combat happens here.' },
  city: { icon: LocationCityIcon, description: 'Streets, districts and buildings.' },
  region: { icon: TerrainIcon, description: 'A province, valley or stretch of wilderness.' },
  continent: { icon: PublicIcon, description: 'Landmasses, kingdoms and coastlines.' },
  world: { icon: PublicIcon, description: 'The whole globe, at the highest zoom.' },
};

const GRID_PRESET_COLORS = ['rgba(128,128,128,0.35)', 'rgba(0,0,0,0.45)', 'rgba(255,255,255,0.45)', 'rgba(198,40,40,0.45)', 'rgba(21,101,192,0.4)'];

function emptyState() {
  return {
    name: '',
    description: '',
    kinds: [] as MapKind[],
    floors: [] as MapFloor[],
    primaryFloorId: '',
    location: '',
    setting: '' as MapSetting | '',
    activity: '',
    customDetails: [] as MapCustomDetail[],
    gridEnabled: false,
    gridSize: DEFAULT_GRID_SIZE,
    gridColor: DEFAULT_GRID_COLOR,
    gridThickness: DEFAULT_GRID_THICKNESS,
    gridType: DEFAULT_GRID_TYPE,
  };
}

function stateFromMap(map: MapData) {
  return {
    name: map.name,
    description: map.description,
    kinds: map.kinds,
    floors: map.floors,
    primaryFloorId: map.primaryFloorId,
    location: map.location ?? '',
    setting: map.setting ?? ('' as MapSetting | ''),
    activity: map.activity ?? '',
    customDetails: map.customDetails ?? [],
    gridEnabled: map.gridEnabled,
    gridSize: map.gridSize,
    gridColor: map.gridColor,
    gridThickness: map.gridThickness,
    gridType: map.gridType,
  };
}

/** One pointy-top hexagon's SVG points, using exactly the geometry MapOverlayLayer draws with
 * (Konva's RegularPolygon puts its first vertex straight up), so the preview here is the grid
 * the DM will actually get rather than a lookalike. */
function hexPoints(cx: number, cy: number, radius: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}

/** The grid drawn over the cover image at the image's own pixel scale. The SVG carries the
 * image's natural dimensions as its viewBox and sits in the same box under the same
 * `contain` fit, so a 70px cell reads as 70 image-pixels here just as it will on the map -
 * which is the only way "cell size" means anything before you have opened the map. */
function GridPreview({
  imageSrc,
  gridEnabled,
  gridSize,
  gridColor,
  gridThickness,
  gridType,
}: {
  imageSrc?: string;
  gridEnabled: boolean;
  gridSize: number;
  gridColor: string;
  gridThickness: number;
  gridType: GridType;
}) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setNatural(null);
  }, [imageSrc]);

  const hexes = useMemo(() => {
    if (!natural || gridType !== 'hex' || gridSize <= 0) return [];
    const radius = gridSize / 2;
    const hexWidth = Math.sqrt(3) * radius;
    const vertSpacing = radius * 1.5;
    const points: string[] = [];
    let row = 0;
    for (let y = 0; y - radius * 2 < natural.height; y += vertSpacing, row++) {
      const xOffset = row % 2 === 1 ? hexWidth / 2 : 0;
      for (let x = xOffset; x - hexWidth < natural.width; x += hexWidth) {
        points.push(hexPoints(x, y, radius));
      }
    }
    return points;
  }, [natural, gridType, gridSize]);

  if (!imageSrc) {
    return (
      <Box sx={{ height: 240, display: 'grid', placeItems: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary">
          Add a floor image to preview the grid.
        </Typography>
      </Box>
    );
  }

  const patternId = 'map-grid-preview-pattern';
  return (
    <Box sx={{ position: 'relative', height: 240, borderRadius: 3, overflow: 'hidden', bgcolor: 'action.hover' }}>
      <Box
        component="img"
        src={imageSrc}
        alt=""
        onLoad={(event) => {
          const img = event.currentTarget;
          setNatural({ width: img.naturalWidth, height: img.naturalHeight });
        }}
        sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
      {gridEnabled && natural && gridSize > 0 && (
        <Box
          component="svg"
          viewBox={`0 0 ${natural.width} ${natural.height}`}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          {gridType === 'square' ? (
            <>
              <defs>
                <pattern id={patternId} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                  <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke={gridColor} strokeWidth={gridThickness} />
                </pattern>
              </defs>
              <rect width={natural.width} height={natural.height} fill={`url(#${patternId})`} />
            </>
          ) : (
            hexes.map((points, index) => (
              <polygon key={index} points={points} fill="none" stroke={gridColor} strokeWidth={gridThickness} />
            ))
          )}
        </Box>
      )}
    </Box>
  );
}

/** Creating a map used to be one tall scroll: name, type, story details, custom rows and floor
 * uploads all stacked in a single `sm` dialog, with the one genuinely required thing (an image)
 * furthest from the eye. It is now a four-phase card - the same shape PlaceBuilderDialog and
 * EncounterBuilderDialog already use - so each screen asks for one kind of thing, the required
 * ones are impossible to skip past, and the last phase shows what is about to be created. */
export function MapFormDialog({ open, onClose, onSubmit, initialMap }: MapFormDialogProps) {
  const isEditMode = !!initialMap;
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kinds, setKinds] = useState<MapKind[]>([]);
  const [floors, setFloors] = useState<MapFloor[]>([]);
  const [primaryFloorId, setPrimaryFloorId] = useState('');
  const [location, setLocation] = useState('');
  const [setting, setSetting] = useState<MapSetting | ''>('');
  const [activity, setActivity] = useState('');
  const [customDetails, setCustomDetails] = useState<MapCustomDetail[]>([]);
  const [gridEnabled, setGridEnabled] = useState(false);
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [gridColor, setGridColor] = useState(DEFAULT_GRID_COLOR);
  const [gridThickness, setGridThickness] = useState(DEFAULT_GRID_THICKNESS);
  const [gridType, setGridType] = useState<GridType>(DEFAULT_GRID_TYPE);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const initial = initialMap ? stateFromMap(initialMap) : emptyState();
    setStep(0);
    setName(initial.name);
    setDescription(initial.description);
    setKinds(initial.kinds);
    setFloors(initial.floors);
    setPrimaryFloorId(initial.primaryFloorId);
    setLocation(initial.location);
    setSetting(initial.setting);
    setActivity(initial.activity);
    setCustomDetails(initial.customDetails);
    setGridEnabled(initial.gridEnabled);
    setGridSize(initial.gridSize);
    setGridColor(initial.gridColor);
    setGridThickness(initial.gridThickness);
    setGridType(initial.gridType);
    setFileError(null);
    setDragActive(false);
  }, [open, initialMap]);

  const toggleKind = (kind: MapKind) =>
    setKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));

  const addCustomDetail = () => setCustomDetails((prev) => [...prev, { id: crypto.randomUUID(), label: '', value: '' }]);
  const updateCustomDetail = (id: string, changes: Partial<Pick<MapCustomDetail, 'label' | 'value'>>) =>
    setCustomDetails((prev) => prev.map((d) => (d.id === id ? { ...d, ...changes } : d)));
  const removeCustomDetail = (id: string) => setCustomDetails((prev) => prev.filter((d) => d.id !== id));

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    const validFiles = files.filter(isAllowedImageFile);
    if (validFiles.length < files.length) {
      setFileError('Some files were skipped — only PNG or JPG images are allowed.');
    }
    if (validFiles.length === 0) return;
    // The ids are minted HERE, not inside the setFloors updater. Under StrictMode React runs
    // an updater twice and keeps only the second result, so generating uuids in there produced
    // one set of floors in state and a DIFFERENT set for the `setPrimaryFloorId` side effect
    // that used to sit beside them - the cover id pointed at a floor that was never saved, and
    // creating the map failed with an FK violation (409) after the floors had already been
    // written. A state updater must be pure; both of these now run outside one.
    const additions: MapFloor[] = validFiles.map((file, index) =>
      createEmptyFloor(crypto.randomUUID(), `Floor ${floors.length + index + 1}`, URL.createObjectURL(file)),
    );
    setFloors((prev) => [...prev, ...additions]);
    setPrimaryFloorId((currentPrimary) => currentPrimary || additions[0].id);
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    addFiles(files);
  };

  const handleFloorNameChange = (floorId: string, newName: string) =>
    setFloors((prev) => prev.map((f) => (f.id === floorId ? { ...f, name: newName } : f)));

  const handleFloorRemove = (floorId: string) => {
    const next = floors.filter((f) => f.id !== floorId);
    setFloors(next);
    if (primaryFloorId === floorId) setPrimaryFloorId(next[0]?.id ?? '');
  };

  const moveFloor = (index: number, delta: number) =>
    setFloors((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const basicsValid = name.trim().length > 0 && kinds.length > 0;
  const floorsValid = floors.length > 0;
  const isValid = basicsValid && floorsValid;
  const stepValid = [basicsValid, floorsValid, true, isValid];
  const coverFloor = floors.find((f) => f.id === primaryFloorId) ?? floors[0];

  const handleSubmit = () => {
    if (!isValid) return;
    const now = Date.now();
    const map: MapData = {
      id: initialMap?.id ?? crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      kinds,
      floors,
      primaryFloorId: primaryFloorId || floors[0].id,
      gridEnabled,
      gridSize,
      gridColor,
      gridThickness,
      gridType,
      location: location.trim() || undefined,
      setting: setting || undefined,
      activity: activity.trim() || undefined,
      customDetails: customDetails.filter((d) => d.label.trim() || d.value.trim()),
      createdAt: initialMap?.createdAt ?? now,
      updatedAt: now,
    };
    onSubmit(map);
  };

  const HeaderIcon = STEPS[step].icon;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 4, minHeight: 640, maxHeight: '94vh' } } }}>
      <DialogTitle sx={{ px: { xs: 2, md: 3 }, pt: 2.5, pb: 1.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box sx={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 2.5, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <HeaderIcon />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 850 }}>
              {isEditMode ? `Edit ${initialMap.name}` : 'Add a map'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {STEPS[step].caption} — step {step + 1} of {STEPS.length}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <Box sx={{ px: { xs: 2, md: 5 }, pb: 2 }}>
        <Stepper nonLinear activeStep={step} alternativeLabel>
          {STEPS.map((item, index) => (
            <Step key={item.label} completed={index < step && stepValid[index]}>
              <StepButton onClick={() => setStep(index)}>
                <StepLabel error={index < step && !stepValid[index]}>{item.label}</StepLabel>
              </StepButton>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent dividers sx={{ p: { xs: 2, md: 3 }, bgcolor: 'action.hover' }}>
        {step === 0 && (
          <Stack spacing={2.5}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }}>
              <Stack spacing={2}>
                <TextField label="Map name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth autoFocus placeholder="The Abandoned Church" />
                <TextField
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  minRows={2}
                  maxRows={4}
                  fullWidth
                  placeholder="Notes about this map — tone, key encounters, hazards…"
                />
              </Stack>
            </Paper>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                What kind of map is it?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pick one or more. Types are how the library is filtered later, so a city you also fight in can be both.
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
              {MAP_KIND_OPTIONS.map((option) => {
                const meta = KIND_META[option.value];
                const Icon = meta.icon;
                const selected = kinds.includes(option.value);
                return (
                  <Paper
                    component="button"
                    type="button"
                    key={option.value}
                    onClick={() => toggleKind(option.value)}
                    variant="outlined"
                    sx={{
                      p: 1.75,
                      minHeight: 116,
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderRadius: 3,
                      borderColor: selected ? 'primary.main' : 'divider',
                      bgcolor: selected ? 'primary.main' : 'background.paper',
                      color: selected ? 'primary.contrastText' : 'text.primary',
                      font: 'inherit',
                      transition: '150ms',
                      '&:hover': { boxShadow: 3 },
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Icon fontSize="small" />
                      {selected && <CheckCircleIcon fontSize="small" sx={{ ml: 'auto' }} />}
                    </Stack>
                    <Typography sx={{ fontWeight: 850, mt: 1 }}>{option.label}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {meta.description}
                    </Typography>
                  </Paper>
                );
              })}
            </Box>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>
                Indoor or outdoor?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Optional. Useful for weather, light and travel rulings later.
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={setting}
                onChange={(_event, value: MapSetting | '' | null) => setSetting(value ?? '')}
              >
                <ToggleButton value="">Unspecified</ToggleButton>
                {MAP_SETTING_OPTIONS.map((option) => (
                  <ToggleButton key={option.value} value={option.value}>
                    {option.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Paper>
          </Stack>
        )}

        {step === 1 && (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Floor images
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Each image becomes a floor you can switch between on the map. One is enough; the starred floor is the cover.
              </Typography>
            </Box>

            <Paper
              variant="outlined"
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                addFiles(Array.from(event.dataTransfer.files ?? []));
              }}
              sx={{
                p: 3,
                borderRadius: 3,
                borderStyle: 'dashed',
                borderColor: dragActive ? 'primary.main' : 'divider',
                bgcolor: dragActive ? 'action.selected' : 'background.paper',
                textAlign: 'center',
                transition: '150ms',
              }}
            >
              <AddPhotoAlternateIcon color={dragActive ? 'primary' : 'action'} sx={{ fontSize: 40 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 0.5 }}>
                Drop PNG or JPG images here
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Drop several at once to build a multi-floor map in one go.
              </Typography>
              <Button variant="outlined" startIcon={<AddPhotoAlternateIcon />} onClick={() => fileInputRef.current?.click()}>
                Browse images
              </Button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" multiple hidden onChange={handleFilesSelected} />
            </Paper>

            {floors.length > 0 && (
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <LayersIcon fontSize="small" color="action" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {floors.length} floor{floors.length === 1 ? '' : 's'}
                  </Typography>
                </Stack>
                {floors.map((floor, index) => (
                  <Paper key={floor.id} variant="outlined" sx={{ p: 1, borderRadius: 3, bgcolor: 'background.paper' }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Box
                        component="img"
                        src={floor.imageSrc}
                        alt={floor.name}
                        sx={{ width: 64, height: 64, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
                      />
                      <TextField
                        value={floor.name}
                        onChange={(e) => handleFloorNameChange(floor.id, e.target.value)}
                        size="small"
                        fullWidth
                        variant="standard"
                        placeholder={`Floor ${index + 1}`}
                      />
                      <Stack direction="row" sx={{ flexShrink: 0 }}>
                        <Tooltip title="Move up">
                          <span>
                            <IconButton size="small" disabled={index === 0} onClick={() => moveFloor(index, -1)}>
                              <ArrowUpwardIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Move down">
                          <span>
                            <IconButton size="small" disabled={index === floors.length - 1} onClick={() => moveFloor(index, 1)}>
                              <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={primaryFloorId === floor.id ? 'Cover image' : 'Set as cover image'}>
                          <IconButton size="small" onClick={() => setPrimaryFloorId(floor.id)}>
                            {primaryFloorId === floor.id ? <StarIcon fontSize="small" color="primary" /> : <StarBorderIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove floor">
                          <IconButton size="small" onClick={() => handleFloorRemove(floor.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        )}

        {step === 2 && (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Story & context
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All optional, and all searchable — this is what lets you find a map later by where it is or what happens on it.
              </Typography>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }}>
              <Stack spacing={2}>
                <TextField
                  label="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Northern Eboron, near the Frosthold pass"
                  helperText="Maps sharing a location can be filtered together on the Maps page."
                />
                <TextField
                  label="What's happening here"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  multiline
                  minRows={3}
                  maxRows={6}
                  fullWidth
                  size="small"
                  placeholder="What's planned, happening, or already happened on this map…"
                />
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>
                    Additional details
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Factions present, weather, loot, light level — whatever you want on hand.
                  </Typography>
                </Box>
                <Button size="small" startIcon={<AddIcon />} onClick={addCustomDetail}>
                  Add detail
                </Button>
              </Stack>
              {customDetails.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Nothing yet.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {customDetails.map((detail) => (
                    <Stack key={detail.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <TextField
                        size="small"
                        variant="standard"
                        placeholder="Label"
                        value={detail.label}
                        onChange={(e) => updateCustomDetail(detail.id, { label: e.target.value })}
                        sx={{ width: 160 }}
                      />
                      <TextField
                        size="small"
                        variant="standard"
                        placeholder="Value"
                        value={detail.value}
                        onChange={(e) => updateCustomDetail(detail.id, { value: e.target.value })}
                        fullWidth
                      />
                      <IconButton size="small" onClick={() => removeCustomDetail(detail.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>
        )}

        {step === 3 && (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Grid & review
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The grid is what movement is measured against — one cell is 5 ft. Everything here stays editable from the map toolbar.
              </Typography>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }}>
              <FormControlLabel
                control={<Switch checked={gridEnabled} onChange={(e) => setGridEnabled(e.target.checked)} />}
                label={<Typography sx={{ fontWeight: 800 }}>Show a grid on this map</Typography>}
              />
              {gridEnabled && (
                <Stack spacing={2} sx={{ mt: 1.5 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={gridType}
                      onChange={(_event, value: GridType | null) => value && setGridType(value)}
                    >
                      <ToggleButton value="square">
                        <GridOnIcon fontSize="small" sx={{ mr: 0.75 }} /> Square
                      </ToggleButton>
                      <ToggleButton value="hex">
                        <HexagonOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} /> Hex
                      </ToggleButton>
                    </ToggleButtonGroup>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel id="grid-thickness-label">Line thickness</InputLabel>
                      <Select
                        labelId="grid-thickness-label"
                        label="Line thickness"
                        value={gridThickness}
                        onChange={(e) => setGridThickness(Number(e.target.value))}
                      >
                        {[1, 2, 3, 4].map((value) => (
                          <MenuItem key={value} value={value}>
                            {value}px
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Cell size — {gridSize}px per 5 ft
                    </Typography>
                    <Slider value={gridSize} min={20} max={200} step={5} valueLabelDisplay="auto" onChange={(_event, value) => setGridSize(value as number)} />
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                      Line colour
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      {GRID_PRESET_COLORS.map((color) => (
                        <Box
                          component="button"
                          type="button"
                          key={color}
                          aria-label={`Grid colour ${color}`}
                          onClick={() => setGridColor(color)}
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            bgcolor: color,
                            border: '2px solid',
                            borderColor: gridColor === color ? 'primary.main' : 'divider',
                            outline: gridColor === color ? '2px solid' : 'none',
                            outlineColor: 'primary.main',
                            outlineOffset: 2,
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>

                  <GridPreview
                    imageSrc={coverFloor?.imageSrc}
                    gridEnabled={gridEnabled}
                    gridSize={gridSize}
                    gridColor={gridColor}
                    gridThickness={gridThickness}
                    gridType={gridType}
                  />
                </Stack>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper' }}>
              <Stack direction="row" spacing={2} sx={{ p: 2, alignItems: 'center' }}>
                {coverFloor && (
                  <Box component="img" src={coverFloor.imageSrc} alt="" sx={{ width: 84, height: 84, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 850 }} noWrap>
                    {name.trim() || 'Untitled map'}
                  </Typography>
                  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 0.5 }}>
                    {kinds.length === 0 ? (
                      <Chip size="small" color="error" variant="outlined" label="No type chosen" />
                    ) : (
                      kinds.map((kind) => {
                        const option = MAP_KIND_OPTIONS.find((o) => o.value === kind)!;
                        return <Chip key={kind} size="small" color={option.color} label={option.label} />;
                      })
                    )}
                  </Stack>
                </Box>
              </Stack>
              <Divider />
              {[
                { label: 'Floors', value: floors.length > 0 ? floors.map((f) => f.name).join(', ') : 'None yet' },
                { label: 'Indoor / Outdoor', value: MAP_SETTING_OPTIONS.find((o) => o.value === setting)?.label ?? 'Unspecified' },
                { label: 'Location', value: location.trim() || 'Not set' },
                { label: "What's happening", value: activity.trim() || 'Not set' },
                {
                  label: 'Grid',
                  value: gridEnabled ? `${gridType === 'hex' ? 'Hex' : 'Square'}, ${gridSize}px cells, ${gridThickness}px lines` : 'Off',
                },
                {
                  label: 'Additional details',
                  value: customDetails.filter((d) => d.label.trim() || d.value.trim()).length
                    ? customDetails
                        .filter((d) => d.label.trim() || d.value.trim())
                        .map((d) => `${d.label.trim() || 'Detail'}: ${d.value.trim()}`)
                        .join(' · ')
                    : 'None',
                },
              ].map((row, index, rows) => (
                <Box key={row.label}>
                  <Stack direction="row" spacing={2} sx={{ px: 2, py: 1.25 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0, fontWeight: 750 }}>
                      {row.label}
                    </Typography>
                    <Typography variant="body2" sx={{ minWidth: 0 }}>
                      {row.value}
                    </Typography>
                  </Stack>
                  {index < rows.length - 1 && <Divider />}
                </Box>
              ))}
            </Paper>

            {!isValid && (
              <Alert severity="warning">
                {!basicsValid ? 'Give the map a name and at least one type (step 1) ' : ''}
                {!basicsValid && !floorsValid ? 'and ' : ''}
                {!floorsValid ? 'add at least one floor image (step 2) ' : ''}
                before creating it.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button color="inherit" startIcon={step > 0 ? <NavigateBeforeIcon /> : undefined} onClick={step === 0 ? onClose : () => setStep((value) => value - 1)}>
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Stack direction="row" spacing={1}>
          {step < STEPS.length - 1 && isEditMode && isValid && (
            <Button onClick={handleSubmit} color="inherit">
              Save changes
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button variant="contained" endIcon={<NavigateNextIcon />} disabled={!stepValid[step]} onClick={() => setStep((value) => value + 1)}>
              {STEPS[step + 1].label}
            </Button>
          ) : (
            <Button variant="contained" startIcon={<CheckCircleIcon />} disabled={!isValid} onClick={handleSubmit}>
              {isEditMode ? 'Save changes' : 'Create map'}
            </Button>
          )}
        </Stack>
      </DialogActions>

      <Snackbar open={!!fileError} autoHideDuration={4000} onClose={() => setFileError(null)}>
        <Alert severity="warning" onClose={() => setFileError(null)} sx={{ width: '100%' }}>
          {fileError}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
