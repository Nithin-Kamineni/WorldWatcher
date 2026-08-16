import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Slider from '@mui/material/Slider';
import TuneIcon from '@mui/icons-material/Tune';
import { FACTION_TYPE_PRESETS, type Faction } from '../../types/faction';

interface FactionFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (faction: Faction) => void;
  initialFaction?: Faction;
}

function emptyState() {
  return {
    name: '',
    description: '',
    factionType: '',
    goals: [] as string[],
    beliefs: [] as string[],
    resources: [] as string[],
    locations: [] as string[],
    members: [] as string[],
    notes: '',
    governance: '',
    power: 1,
    powerLabel: '',
    locationSummary: '',
    military: 30,
    naval: 30,
    economy: 30,
    reputation: 30,
  };
}

function stateFromFaction(faction: Faction) {
  return {
    name: faction.name,
    description: faction.description,
    factionType: faction.factionType,
    goals: faction.goals,
    beliefs: faction.beliefs,
    resources: faction.resources,
    locations: faction.locations,
    members: faction.members,
    notes: faction.notes,
    governance: faction.governance,
    power: faction.power,
    powerLabel: faction.powerLabel,
    locationSummary: faction.locationSummary,
    military: faction.military,
    naval: faction.naval,
    economy: faction.economy,
    reputation: faction.reputation,
  };
}

function StatSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {value}
        </Typography>
      </Stack>
      <Slider size="small" value={value} min={0} max={100} onChange={(_e, v) => onChange(v as number)} />
    </Stack>
  );
}

interface TagListFieldProps {
  label: string;
  placeholder: string;
  value: string[];
  onChange: (value: string[]) => void;
}

function TagListField({ label, placeholder, value, onChange }: TagListFieldProps) {
  return (
    <Autocomplete<string, true, false, true>
      multiple
      freeSolo
      options={[]}
      value={value}
      onChange={(_e, next) => onChange(next as string[])}
      renderValue={(vals, getItemProps) =>
        vals.map((tag, index) => <Chip label={tag} size="small" {...getItemProps({ index })} key={tag} />)
      }
      renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} />}
    />
  );
}

export function FactionFormDialog({ open, onClose, onSubmit, initialFaction }: FactionFormDialogProps) {
  const isEditMode = !!initialFaction;
  const [state, setState] = useState(emptyState());
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setState(initialFaction ? stateFromFaction(initialFaction) : emptyState());
    setMoreOpen(false);
  }, [open, initialFaction]);

  const set = <K extends keyof ReturnType<typeof emptyState>>(key: K, value: ReturnType<typeof emptyState>[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const isValid = state.name.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const now = Date.now();
    const faction: Faction = {
      id: initialFaction?.id ?? crypto.randomUUID(),
      name: state.name.trim(),
      description: state.description.trim(),
      factionType: state.factionType.trim(),
      goals: state.goals,
      beliefs: state.beliefs,
      resources: state.resources,
      locations: state.locations,
      members: state.members,
      notes: state.notes.trim(),
      imageSrc: initialFaction?.imageSrc ?? '',
      governance: state.governance.trim(),
      power: state.power,
      powerLabel: state.powerLabel.trim() || String(state.power),
      locationSummary: state.locationSummary.trim(),
      military: state.military,
      naval: state.naval,
      economy: state.economy,
      reputation: state.reputation,
      createdAt: initialFaction?.createdAt ?? now,
      updatedAt: now,
    };
    onSubmit(faction);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEditMode ? 'Edit Faction' : 'Add Faction'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField label="Name" value={state.name} onChange={(e) => set('name', e.target.value)} required fullWidth autoFocus />
          <TextField
            label="Description"
            value={state.description}
            onChange={(e) => set('description', e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
          />
          <Autocomplete
            freeSolo
            options={FACTION_TYPE_PRESETS}
            value={state.factionType}
            onChange={(_e, value) => set('factionType', value ?? '')}
            onInputChange={(_e, value) => set('factionType', value)}
            renderInput={(params) => (
              <TextField {...params} label="Type" placeholder="Guild, Cult, Noble House, Criminal Organization…" />
            )}
          />

          <TagListField label="Goals" placeholder="Type and press Enter" value={state.goals} onChange={(v) => set('goals', v)} />
          <TagListField
            label="Beliefs"
            placeholder="Type and press Enter"
            value={state.beliefs}
            onChange={(v) => set('beliefs', v)}
          />

          <Box>
            <Button size="small" startIcon={<TuneIcon />} onClick={() => setMoreOpen((v) => !v)}>
              {moreOpen ? 'Hide more options' : 'More options'}
            </Button>
            <Collapse in={moreOpen}>
              <Stack spacing={2} sx={{ pt: 2 }}>
                <TagListField
                  label="Resources"
                  placeholder="Gold, safehouses, spies…"
                  value={state.resources}
                  onChange={(v) => set('resources', v)}
                />
                <TagListField
                  label="Locations"
                  placeholder="Headquarters, safehouses, territory…"
                  value={state.locations}
                  onChange={(v) => set('locations', v)}
                />
                <TagListField
                  label="Members"
                  placeholder="Leaders, notable members…"
                  value={state.members}
                  onChange={(v) => set('members', v)}
                />

                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Diplomacy graph
                </Typography>
                <TextField
                  label="Governance"
                  placeholder="Senate of Kingdoms, Monarchy of Nobles…"
                  value={state.governance}
                  onChange={(e) => set('governance', e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Location summary"
                  placeholder="Spread across many continents and islands…"
                  value={state.locationSummary}
                  onChange={(e) => set('locationSummary', e.target.value)}
                  fullWidth
                />
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <TextField
                      label="Power"
                      type="number"
                      value={state.power}
                      onChange={(e) => set('power', Number(e.target.value))}
                      fullWidth
                    />
                  </Grid>
                  <Grid size={6}>
                    <TextField
                      label="Power label"
                      placeholder={String(state.power)}
                      helperText={'Optional override, e.g. ">10"'}
                      value={state.powerLabel}
                      onChange={(e) => set('powerLabel', e.target.value)}
                      fullWidth
                    />
                  </Grid>
                </Grid>
                <Typography variant="caption" color="text.secondary">
                  Strength stats used by the diplomacy graph's comparison bars
                </Typography>
                <StatSlider label="Military" value={state.military} onChange={(v) => set('military', v)} />
                <StatSlider label="Naval" value={state.naval} onChange={(v) => set('naval', v)} />
                <StatSlider label="Economy" value={state.economy} onChange={(v) => set('economy', v)} />
                <StatSlider label="Reputation" value={state.reputation} onChange={(v) => set('reputation', v)} />
              </Stack>
            </Collapse>
          </Box>

          <Divider />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Notes
          </Typography>
          <TextField
            value={state.notes}
            onChange={(e) => set('notes', e.target.value)}
            multiline
            minRows={2}
            maxRows={6}
            fullWidth
            placeholder="Anything else the DM should remember about this faction…"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid}>
          {isEditMode ? 'Save Changes' : 'Add Faction'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
