import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import LayersIcon from '@mui/icons-material/Layers';
import AddIcon from '@mui/icons-material/Add';
import { isAllowedImageFile } from '../../utils/fileValidation';
import {
  createEmptyFloor,
  DEFAULT_GRID_COLOR,
  DEFAULT_GRID_SIZE,
  DEFAULT_GRID_THICKNESS,
  DEFAULT_GRID_TYPE,
  MAP_KIND_OPTIONS,
  MAP_SETTING_OPTIONS,
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
  };
}

export function MapFormDialog({ open, onClose, onSubmit, initialMap }: MapFormDialogProps) {
  const isEditMode = !!initialMap;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kinds, setKinds] = useState<MapKind[]>([]);
  const [floors, setFloors] = useState<MapFloor[]>([]);
  const [primaryFloorId, setPrimaryFloorId] = useState('');
  const [location, setLocation] = useState('');
  const [setting, setSetting] = useState<MapSetting | ''>('');
  const [activity, setActivity] = useState('');
  const [customDetails, setCustomDetails] = useState<MapCustomDetail[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const initial = initialMap ? stateFromMap(initialMap) : emptyState();
    setName(initial.name);
    setDescription(initial.description);
    setKinds(initial.kinds);
    setFloors(initial.floors);
    setPrimaryFloorId(initial.primaryFloorId);
    setLocation(initial.location);
    setSetting(initial.setting);
    setActivity(initial.activity);
    setCustomDetails(initial.customDetails);
    setFileError(null);
  }, [open, initialMap]);

  const addCustomDetail = () => {
    setCustomDetails((prev) => [...prev, { id: crypto.randomUUID(), label: '', value: '' }]);
  };

  const updateCustomDetail = (id: string, changes: Partial<Pick<MapCustomDetail, 'label' | 'value'>>) => {
    setCustomDetails((prev) => prev.map((d) => (d.id === id ? { ...d, ...changes } : d)));
  };

  const removeCustomDetail = (id: string) => {
    setCustomDetails((prev) => prev.filter((d) => d.id !== id));
  };

  const handleKindsChange = (event: SelectChangeEvent<MapKind[]>) => {
    const value = event.target.value;
    setKinds(typeof value === 'string' ? (value.split(',') as MapKind[]) : value);
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const validFiles = files.filter(isAllowedImageFile);
    if (validFiles.length < files.length) {
      setFileError('Some files were skipped — only PNG or JPG images are allowed.');
    }

    setFloors((prev) => {
      const additions: MapFloor[] = validFiles.map((file, index) =>
        createEmptyFloor(crypto.randomUUID(), `Floor ${prev.length + index + 1}`, URL.createObjectURL(file)),
      );
      const next = [...prev, ...additions];
      setPrimaryFloorId((currentPrimary) => currentPrimary || next[0]?.id || '');
      return next;
    });
  };

  const handleFloorNameChange = (floorId: string, newName: string) => {
    setFloors((prev) => prev.map((f) => (f.id === floorId ? { ...f, name: newName } : f)));
  };

  const handleFloorRemove = (floorId: string) => {
    setFloors((prev) => {
      const next = prev.filter((f) => f.id !== floorId);
      setPrimaryFloorId((currentPrimary) => (currentPrimary === floorId ? next[0]?.id ?? '' : currentPrimary));
      return next;
    });
  };

  const isValid = name.trim().length > 0 && kinds.length > 0 && floors.length > 0;

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
      gridEnabled: initialMap?.gridEnabled ?? false,
      gridSize: initialMap?.gridSize ?? DEFAULT_GRID_SIZE,
      gridColor: initialMap?.gridColor ?? DEFAULT_GRID_COLOR,
      gridThickness: initialMap?.gridThickness ?? DEFAULT_GRID_THICKNESS,
      gridType: initialMap?.gridType ?? DEFAULT_GRID_TYPE,
      location: location.trim() || undefined,
      setting: setting || undefined,
      activity: activity.trim() || undefined,
      customDetails: customDetails.filter((d) => d.label.trim() || d.value.trim()),
      createdAt: initialMap?.createdAt ?? now,
      updatedAt: now,
    };
    onSubmit(map);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEditMode ? 'Edit Map' : 'Add Map'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField
            label="Map name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoFocus
          />

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

          <FormControl fullWidth required>
            <InputLabel id="map-kind-label">Map type</InputLabel>
            <Select
              labelId="map-kind-label"
              label="Map type"
              multiple
              value={kinds}
              onChange={handleKindsChange}
              renderValue={(selected) => (
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {selected.map((kind) => {
                    const option = MAP_KIND_OPTIONS.find((o) => o.value === kind)!;
                    return <Chip key={kind} label={option.label} color={option.color} size="small" />;
                  })}
                </Stack>
              )}
            >
              {MAP_KIND_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Checkbox checked={kinds.includes(option.value)} size="small" />
                  <ListItemText primary={option.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Story details
          </Typography>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              fullWidth
              size="small"
              placeholder="Where in the world this takes place…"
            />
            <FormControl fullWidth size="small">
              <InputLabel id="map-setting-label">Indoor / Outdoor</InputLabel>
              <Select
                labelId="map-setting-label"
                label="Indoor / Outdoor"
                value={setting}
                onChange={(e) => setSetting(e.target.value as MapSetting | '')}
              >
                <MenuItem value="">
                  <em>Unspecified</em>
                </MenuItem>
                {MAP_SETTING_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <TextField
            label="What's happening here"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
            size="small"
            placeholder="What's planned, happening, or already happened on this map…"
          />

          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Additional details
              </Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addCustomDetail}>
                Add detail
              </Button>
            </Stack>
            {customDetails.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                Track anything else you want here — factions present, weather, loot, whatever comes up.
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
                      sx={{ width: 140 }}
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
          </Box>

          <Divider />

          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <LayersIcon fontSize="small" color="action" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Floor images
                </Typography>
              </Stack>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddPhotoAlternateIcon />}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload images
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                multiple
                hidden
                onChange={handleFilesSelected}
              />
            </Stack>

            {floors.length === 0 ? (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 3,
                  borderRadius: 3,
                  border: '1px dashed',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Upload one or more images. Each becomes a floor of this map.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {floors.map((floor) => (
                  <Stack
                    key={floor.id}
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}
                  >
                    <Box
                      component="img"
                      src={floor.imageSrc}
                      alt={floor.name}
                      sx={{ width: 56, height: 56, borderRadius: 1.5, objectFit: 'cover', flexShrink: 0 }}
                    />
                    <TextField
                      value={floor.name}
                      onChange={(e) => handleFloorNameChange(floor.id, e.target.value)}
                      size="small"
                      fullWidth
                      variant="standard"
                    />
                    <Tooltip title={primaryFloorId === floor.id ? 'Cover image' : 'Set as cover image'}>
                      <IconButton size="small" onClick={() => setPrimaryFloorId(floor.id)}>
                        {primaryFloorId === floor.id ? (
                          <StarIcon fontSize="small" color="primary" />
                        ) : (
                          <StarBorderIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove floor">
                      <IconButton size="small" onClick={() => handleFloorRemove(floor.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid}>
          {isEditMode ? 'Save Changes' : 'Create Map'}
        </Button>
      </DialogActions>
      <Snackbar open={!!fileError} autoHideDuration={4000} onClose={() => setFileError(null)}>
        <Alert severity="warning" onClose={() => setFileError(null)} sx={{ width: '100%' }}>
          {fileError}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
