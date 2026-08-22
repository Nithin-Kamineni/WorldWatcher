import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Autocomplete from '@mui/material/Autocomplete';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import {
  RELATION_IMPORTANCE_OPTIONS,
  RELATION_TYPES,
  RELATION_TYPE_META,
  findRelation,
  type FactionRelation,
  type FactionRelationImportance,
  type FactionRelationType,
} from '../../types/factionRelation';
import type { Faction } from '../../types/faction';

interface FactionRelationsFieldProps {
  campaignId: string;
  factionId: string;
  allFactions: Faction[];
  relations: FactionRelation[];
  onAddRelation: (relation: FactionRelation) => void;
  onUpdateRelation: (relation: FactionRelation) => void;
  onDeleteRelation: (campaignId: string, relationId: string) => void;
}

/** Repeatable relation-editor rows shown inside FactionFormDialog when editing an
 * existing faction (a brand-new faction has no id yet to attach a relation to). Each
 * row is "this faction" <-> "another faction", with the relation type + importance;
 * finer-grained strength/treaties/notes stay in the graph's FactionRelationDialog. */
export function FactionRelationsField({
  campaignId,
  factionId,
  allFactions,
  relations,
  onAddRelation,
  onUpdateRelation,
  onDeleteRelation,
}: FactionRelationsFieldProps) {
  const otherFactions = allFactions.filter((f) => f.id !== factionId);
  const rows = relations
    .filter((r) => r.factionAId === factionId || r.factionBId === factionId)
    .map((r) => ({
      relation: r,
      other: allFactions.find((f) => f.id === (r.factionAId === factionId ? r.factionBId : r.factionAId)),
    }))
    .filter((row): row is { relation: FactionRelation; other: Faction } => !!row.other);

  const availableToAdd = otherFactions.filter((f) => !findRelation(relations, factionId, f.id));

  const handleAdd = (other: Faction) => {
    onAddRelation({
      id: crypto.randomUUID(),
      campaignId,
      factionAId: factionId,
      factionBId: other.id,
      type: 'neutral',
      strength: 40,
      importance: 'secondary',
      treaties: [],
      notes: '',
    });
  };

  return (
    <Stack spacing={1.5}>
      {rows.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          No relations yet.
        </Typography>
      )}
      {rows.map(({ relation, other }) => (
        <Stack key={relation.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
            {other.name}
          </Typography>
          <TextField
            select
            size="small"
            value={relation.type}
            onChange={(e) => onUpdateRelation({ ...relation, type: e.target.value as FactionRelationType })}
            sx={{ width: 150 }}
          >
            {RELATION_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {RELATION_TYPE_META[t].label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            value={relation.importance}
            onChange={(e) => onUpdateRelation({ ...relation, importance: e.target.value as FactionRelationImportance })}
            sx={{ width: 130 }}
          >
            {RELATION_IMPORTANCE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <IconButton size="small" onClick={() => onDeleteRelation(campaignId, relation.id)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}

      {availableToAdd.length > 0 && (
        <Box>
          <Autocomplete
            options={availableToAdd}
            getOptionLabel={(f) => f.name}
            onChange={(_e, value) => value && handleAdd(value)}
            value={null}
            blurOnSelect
            clearOnBlur
            // The dropdown Popper is portaled to <body> without an explicit z-index, so
            // nested inside a Dialog (z-index: theme.zIndex.modal) it opens *behind* the
            // dialog paper - invisible, even though it's technically working. Bump it above
            // the modal layer so it's actually visible/clickable.
            slotProps={{ popper: { sx: { zIndex: (theme) => theme.zIndex.modal + 1 } } }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder="Add relation to…"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <AddIcon fontSize="small" sx={{ ml: 0.5, mr: -0.5, color: 'text.secondary' }} />,
                }}
              />
            )}
          />
        </Box>
      )}
    </Stack>
  );
}
