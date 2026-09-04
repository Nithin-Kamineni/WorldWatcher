import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Autocomplete from '@mui/material/Autocomplete';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { TagPicker } from './TagPicker';
import { useGeneratorStore } from '../../../store/useGeneratorStore';
import { useCategoryStore, categoryPath } from '../../../store/useCategoryStore';
import { generatorToApiPayload, generatorComponentToApiPayload, apiRandomTableToTable } from '../../../api/adapters';
import * as randomTablesApi from '../../../api/resources/randomTables';
import { ApiError } from '../../../api/client';
import type { GeneratorComponent, GeneratorDetail, GeneratorParameter } from '../../../types/generator';
import type { RandomTable } from '../../../types/randomTable';
import type { Category } from '../../../types/category';

interface GeneratorEditorProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  initialGenerator?: GeneratorDetail;
  initialCategoryId?: string | null;
  onSaved: (detail: GeneratorDetail) => void;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || `generator-${Math.random().toString(36).slice(2, 8)}`;
}

function newParameter(): GeneratorParameter {
  return { key: '', label: '', type: 'tag', allowedTags: [], required: false, default: null };
}

function newComponent(): GeneratorComponent {
  return { id: crypto.randomUUID(), generatorId: '', tableId: '', outputSlot: '', filterParamKey: null, rollCount: 1, optional: false, sortOrder: 0 };
}

function emptyState() {
  return {
    slug: '', slugTouched: false, name: '', description: '', categoryId: null as string | null, tagIds: [] as string[],
    combineTemplate: '', parameters: [] as GeneratorParameter[], components: [] as GeneratorComponent[],
  };
}

function stateFromDetail(detail: GeneratorDetail) {
  return {
    slug: detail.slug, slugTouched: true, name: detail.name, description: detail.description ?? '',
    categoryId: detail.categoryId, tagIds: detail.tagIds, combineTemplate: detail.combineTemplate,
    parameters: detail.parameters.map((p) => ({ ...p, allowedTags: [...p.allowedTags] })),
    components: detail.components.map((c) => ({ ...c })),
  };
}

/** Create/edit dialog for a Generator: metadata + parameters[] (the input form GeneratorRunner
 * renders) + components[] (which tables feed which output slot, and whether/how they're
 * tag-filtered by a parameter). Saves metadata via createGenerator/updateGenerator and
 * components via replaceComponents. */
export function GeneratorEditor({ open, onClose, campaignId, initialGenerator, initialCategoryId = null, onSaved }: GeneratorEditorProps) {
  const [state, setState] = useState(emptyState());
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tableOptions, setTableOptions] = useState<RandomTable[]>([]);

  const createGenerator = useGeneratorStore((s) => s.createGenerator);
  const updateGenerator = useGeneratorStore((s) => s.updateGenerator);
  const replaceComponents = useGeneratorStore((s) => s.replaceComponents);

  const flatCategories = useCategoryStore((s) => s.flat);
  const fetchTree = useCategoryStore((s) => s.fetchTree);

  useEffect(() => {
    if (!open) return;
    setState(initialGenerator ? stateFromDetail(initialGenerator) : { ...emptyState(), categoryId: initialCategoryId });
    setActiveStep(0);
    setError(null);
    fetchTree();
    randomTablesApi
      .listRandomTables({ campaign_id: campaignId, scope: 'own_or_global', limit: 200 })
      .then((page) => setTableOptions(page.items.map(apiRandomTableToTable)))
      .catch((err) => console.error('Failed to load tables for generator component picker', err));
  }, [open, initialGenerator, initialCategoryId, campaignId, fetchTree]);

  const set = <K extends keyof ReturnType<typeof emptyState>>(key: K, value: ReturnType<typeof emptyState>[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const setName = (name: string) => {
    setState((prev) => ({ ...prev, name, slug: prev.slugTouched ? prev.slug : slugify(name) }));
  };

  const setParameters = (parameters: GeneratorParameter[]) => set('parameters', parameters);
  const addParameter = () => setParameters([...state.parameters, newParameter()]);
  const removeParameter = (index: number) => setParameters(state.parameters.filter((_, i) => i !== index));
  const updateParameter = (index: number, changes: Partial<GeneratorParameter>) =>
    setParameters(state.parameters.map((p, i) => (i === index ? { ...p, ...changes } : p)));

  const setComponents = (components: GeneratorComponent[]) => set('components', components);
  const addComponent = () => setComponents([...state.components, newComponent()]);
  const removeComponent = (id: string) => setComponents(state.components.filter((c) => c.id !== id));
  const updateComponent = (id: string, changes: Partial<GeneratorComponent>) =>
    setComponents(state.components.map((c) => (c.id === id ? { ...c, ...changes } : c)));

  const isValid = state.name.trim().length > 0 && state.slug.trim().length > 0 && state.combineTemplate.trim().length > 0;

  const handleSave = async () => {
    setError(null);
    if (!state.name.trim() || !state.slug.trim()) {
      setError('Name and slug are required.');
      return;
    }
    if (!state.combineTemplate.trim()) {
      setError('Combine template is required.');
      return;
    }

    const meta = {
      slug: state.slug.trim(), name: state.name.trim(), categoryId: state.categoryId,
      description: state.description.trim() || null, combineTemplate: state.combineTemplate.trim(),
      parameters: state.parameters.filter((p) => p.key.trim().length > 0), tagIds: state.tagIds,
    };

    setSaving(true);
    try {
      if (initialGenerator) {
        const updated = await updateGenerator(initialGenerator.id, generatorToApiPayload({ ...meta, campaignId: initialGenerator.campaignId }));
        if (!updated) {
          setError('Failed to save generator details.');
          setSaving(false);
          return;
        }
        const detail = await replaceComponents(initialGenerator.id, state.components.filter((c) => c.tableId && c.outputSlot.trim()));
        if (detail) onSaved(detail);
        else {
          setError('Failed to save components - check every component has a table and output slot.');
          setSaving(false);
          return;
        }
      } else {
        const payload = {
          ...generatorToApiPayload({ ...meta, campaignId }),
          components: state.components.filter((c) => c.tableId && c.outputSlot.trim()).map(generatorComponentToApiPayload),
        };
        const detail = await createGenerator(payload);
        if (detail) onSaved(detail);
        else {
          setError('Failed to create generator.');
          setSaving(false);
          return;
        }
      }
      setSaving(false);
      onClose();
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to save generator.');
    }
  };

  const categoryOption = flatCategories.find((c) => c.id === state.categoryId) ?? null;
  const goToBuilder = () => {
    if (!state.name.trim() || !state.slug.trim() || !state.combineTemplate.trim()) {
      setError('Add a name and output template before composing the generator.');
      return;
    }
    setError(null);
    if (state.components.length === 0) {
      setComponents(['appearance', 'occupation', 'motivation'].map((slot, index) => ({ ...newComponent(), outputSlot: slot, sortOrder: index })));
    }
    setActiveStep(1);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth slotProps={{ paper: { sx: { borderRadius: 4, height: 'min(92vh, 980px)' } } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{initialGenerator ? 'Edit Generator' : 'Create Generator'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stepper activeStep={activeStep} alternativeLabel sx={{ maxWidth: 680, mx: 'auto', width: '100%' }}>
            <Step><StepLabel>Identity & output</StepLabel></Step>
            <Step><StepLabel>Inputs & component tables</StepLabel></Step>
          </Stepper>

          {activeStep === 0 && <>

          <Stack direction="row" spacing={2}>
            <TextField label="Name" value={state.name} onChange={(e) => setName(e.target.value)} required fullWidth autoFocus />
            <TextField
              label="Slug"
              value={state.slug}
              onChange={(e) => setState((prev) => ({ ...prev, slug: e.target.value, slugTouched: true }))}
              helperText="Unique id used in URLs/lookups"
              sx={{ width: 220 }}
            />
          </Stack>
          <TextField
            label="Description"
            value={state.description}
            onChange={(e) => set('description', e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
          />

          <Stack direction="row" spacing={2}>
            <Autocomplete<Category>
              options={flatCategories}
              value={categoryOption}
              getOptionLabel={(c) => categoryPath(flatCategories, c.id)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_e, value) => set('categoryId', value?.id ?? null)}
              renderInput={(params) => <TextField {...params} label="Category" />}
              sx={{ flex: 1 }}
            />
          </Stack>

          <TagPicker selectedTagIds={state.tagIds} onChange={(ids) => set('tagIds', ids)} />

          <TextField
            label="Combine template"
            value={state.combineTemplate}
            onChange={(e) => set('combineTemplate', e.target.value)}
            placeholder="{name}, a {occupation} who wants {motivation}"
            helperText="Output slot names in {curly braces}."
            required
            fullWidth
          />

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover' }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>Generator preview</Typography>
              <Chip size="small" color="primary" label={`${state.components.length || 3} output slots`} />
            </Stack>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.paper' }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', lineHeight: 1.8 }}>
                {state.combineTemplate || 'A {appearance} {occupation} who wants {motivation}.'}
              </Typography>
            </Paper>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.5 }}>
              {(state.combineTemplate.match(/\{([^}]+)\}/g) ?? ['{appearance}', '{occupation}', '{motivation}']).map((slot) => <Chip key={slot} size="small" variant="outlined" label={slot} />)}
            </Stack>
          </Paper>

          </>}

          {activeStep === 1 && <>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}12, transparent 70%)` }}>
            <Typography variant="overline" color="text.secondary">Live generator flow</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 1, alignItems: { md: 'center' } }}>
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', flex: 1 }}>
                {state.parameters.length === 0 ? <Chip size="small" variant="outlined" label="No inputs" /> : state.parameters.map((parameter) => <Chip key={parameter.key || parameter.label} size="small" variant="outlined" label={parameter.label || parameter.key || 'New input'} />)}
              </Stack>
              <Typography color="text.secondary">→</Typography>
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', flex: 1.5 }}>
                {state.components.map((component) => <Chip key={component.id} size="small" color="primary" label={`{${component.outputSlot || 'slot'}}`} />)}
              </Stack>
              <Typography color="text.secondary">→</Typography>
              <Typography variant="caption" sx={{ flex: 1.5, fontFamily: 'monospace' }}>{state.combineTemplate}</Typography>
            </Stack>
          </Paper>

          <Divider />
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Parameters
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addParameter}>
              Add parameter
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Each parameter becomes an input in the roll form. Type "tag" constrains a component's entries to whichever
            allowed tag the DM picks (via the component's "constrained by" setting below); type "text" is free input.
          </Typography>

          {state.parameters.map((param, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 1.25, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }} useFlexGap>
                <TextField
                  size="small"
                  label="Key"
                  value={param.key}
                  onChange={(e) => updateParameter(index, { key: e.target.value })}
                  placeholder="environment"
                  sx={{ width: 150 }}
                />
                <TextField
                  size="small"
                  label="Label"
                  value={param.label}
                  onChange={(e) => updateParameter(index, { label: e.target.value })}
                  placeholder="Environment"
                  sx={{ width: 180 }}
                />
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={param.type}
                  onChange={(_e, value: string | null) => value && updateParameter(index, { type: value })}
                >
                  <ToggleButton value="tag">Tag</ToggleButton>
                  <ToggleButton value="text">Text</ToggleButton>
                </ToggleButtonGroup>
                <FormControlLabel
                  control={<Checkbox size="small" checked={param.required} onChange={(e) => updateParameter(index, { required: e.target.checked })} />}
                  label="Required"
                />
                <TextField
                  size="small"
                  label="Default"
                  value={param.default ?? ''}
                  onChange={(e) => updateParameter(index, { default: e.target.value || null })}
                  sx={{ width: 150 }}
                />
                <Tooltip title="Remove parameter">
                  <IconButton size="small" onClick={() => removeParameter(index)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              {param.type === 'tag' && (
                <Autocomplete<string, true, false, true>
                  multiple
                  freeSolo
                  size="small"
                  options={[]}
                  value={param.allowedTags}
                  onChange={(_e, value) => updateParameter(index, { allowedTags: value as string[] })}
                  renderValue={(value, getItemProps) =>
                    value.map((tag, i) => <Chip label={tag} size="small" {...getItemProps({ index: i })} key={tag} />)
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Allowed tags" placeholder="env:forest, env:urban… (type and press Enter)" sx={{ mt: 1 }} />
                  )}
                />
              )}
            </Paper>
          ))}

          <Divider />
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Components
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addComponent}>
              Add component
            </Button>
          </Stack>

          {state.components.map((component) => (
            <Paper key={component.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
                <Autocomplete
                  size="small"
                  options={tableOptions}
                  getOptionLabel={(t) => t.name}
                  value={tableOptions.find((t) => t.id === component.tableId) ?? null}
                  onChange={(_e, value) => updateComponent(component.id, { tableId: value?.id ?? '' })}
                  renderInput={(params) => <TextField {...params} label="Table" />}
                  sx={{ minWidth: 220, flexGrow: 1 }}
                />
                <TextField
                  size="small"
                  label="Output slot"
                  value={component.outputSlot}
                  onChange={(e) => updateComponent(component.id, { outputSlot: e.target.value })}
                  placeholder="occupation"
                  sx={{ width: 150 }}
                />
                <FormControl size="small" sx={{ minWidth: 170 }}>
                  <InputLabel id={`filter-${component.id}`}>Constrained by</InputLabel>
                  <Select
                    labelId={`filter-${component.id}`}
                    label="Constrained by"
                    value={component.filterParamKey ?? ''}
                    onChange={(e: SelectChangeEvent) => updateComponent(component.id, { filterParamKey: e.target.value || null })}
                  >
                    <MenuItem value="">Fixed (unfiltered)</MenuItem>
                    {state.parameters
                      .filter((p) => p.key.trim())
                      .map((p) => (
                        <MenuItem key={p.key} value={p.key}>
                          {p.label || p.key}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  type="number"
                  label="Roll count"
                  value={component.rollCount}
                  onChange={(e) => updateComponent(component.id, { rollCount: Math.max(1, Number(e.target.value) || 1) })}
                  sx={{ width: 110 }}
                />
                <FormControlLabel
                  control={
                    <Checkbox size="small" checked={component.optional} onChange={(e) => updateComponent(component.id, { optional: e.target.checked })} />
                  }
                  label="Optional"
                />
                <Tooltip title="Remove component">
                  <IconButton size="small" onClick={() => removeComponent(component.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Paper>
          ))}
          {state.components.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No components yet - add at least one to give this generator something to roll.
            </Typography>
          )}
          </>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        {activeStep === 1 && <Button onClick={() => setActiveStep(0)}>Back to details</Button>}
        {activeStep === 0 ? (
          <Button onClick={goToBuilder} variant="contained" disabled={!isValid}>Next: compose generator</Button>
        ) : (
          <Button onClick={handleSave} variant="contained" disabled={!isValid || saving}>
            {initialGenerator ? 'Save Changes' : 'Create Generator'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
