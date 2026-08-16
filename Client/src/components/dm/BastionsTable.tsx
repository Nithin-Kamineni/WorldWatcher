import { Fragment, useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ShieldIcon from '@mui/icons-material/Shield';
import {
  BASTION_FACILITY_INSTANCE_STATUS_OPTIONS,
  type Bastion,
  type BastionFacility,
  type BastionFacilityInstance,
  type BastionFacilityInstanceStatus,
} from '../../types/bastion';
import { TokenThumbnail } from '../map/TokenThumbnail';

interface BastionsTableProps {
  bastions: Bastion[];
  facilityCatalog: BastionFacility[];
  onEdit: (bastion: Bastion) => void;
  onDelete: (bastion: Bastion) => void;
  onExpand: (bastion: Bastion) => void;
  onAddFacility: (bastionId: string, instance: BastionFacilityInstance) => void;
  onUpdateFacility: (bastionId: string, instance: BastionFacilityInstance) => void;
  onRemoveFacility: (bastionId: string, instanceId: string) => void;
}

function newInstance(facilityId: string): BastionFacilityInstance {
  return {
    id: crypto.randomUUID(),
    facilityId,
    customName: '',
    status: 'built',
    defendersAssigned: 0,
    notes: '',
    sortOrder: 0,
  };
}

function BastionDetailRow({
  bastion,
  facilityCatalog,
  onUpdateFacility,
  onRemoveFacility,
  onAddFacility,
}: {
  bastion: Bastion;
  facilityCatalog: BastionFacility[];
  onUpdateFacility: (bastionId: string, instance: BastionFacilityInstance) => void;
  onRemoveFacility: (bastionId: string, instanceId: string) => void;
  onAddFacility: (bastionId: string, instance: BastionFacilityInstance) => void;
}) {
  return (
    <Box sx={{ p: 2, pl: 6 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Facilities
      </Typography>
      {bastion.facilities.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          No facilities built yet.
        </Typography>
      )}
      <Stack spacing={1} sx={{ mb: 2 }}>
        {bastion.facilities.map((instance) => {
          const facility = facilityCatalog.find((f) => f.id === instance.facilityId);
          return (
            <Stack
              key={instance.id}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}
            >
              <TokenThumbnail src={facility?.imageSrc ?? ''} name={facility?.name ?? instance.customName} size={32} />
              <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 120, fontWeight: 600 }}>
                {facility?.name ?? instance.customName ?? 'Facility'}
              </Typography>
              <TextField
                select
                size="small"
                value={instance.status}
                onChange={(e) =>
                  onUpdateFacility(bastion.id, { ...instance, status: e.target.value as BastionFacilityInstanceStatus })
                }
                sx={{ width: 170 }}
              >
                {BASTION_FACILITY_INSTANCE_STATUS_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                type="number"
                label="Defenders"
                value={instance.defendersAssigned}
                onChange={(e) => onUpdateFacility(bastion.id, { ...instance, defendersAssigned: Number(e.target.value) })}
                sx={{ width: 110 }}
              />
              <Tooltip title="Remove facility">
                <IconButton size="small" onClick={() => onRemoveFacility(bastion.id, instance.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          );
        })}
      </Stack>
      <Autocomplete
        options={facilityCatalog}
        getOptionLabel={(f) => f.name}
        value={null}
        onChange={(_e, value) => value && onAddFacility(bastion.id, newInstance(value.id))}
        renderInput={(params) => (
          <TextField {...params} size="small" label="Build a facility" placeholder="Search the facility catalog…" />
        )}
        sx={{ maxWidth: 360 }}
      />
    </Box>
  );
}

export function BastionsTable({
  bastions,
  facilityCatalog,
  onEdit,
  onDelete,
  onExpand,
  onAddFacility,
  onUpdateFacility,
  onRemoveFacility,
}: BastionsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (bastion: Bastion) => {
    if (expandedId === bastion.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(bastion.id);
    onExpand(bastion);
  };

  return (
    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 700 }} />
            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Owner</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Facilities</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Treasury</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {bastions.map((bastion) => {
            const expanded = expandedId === bastion.id;
            return (
              <Fragment key={bastion.id}>
                <TableRow hover sx={{ '& > td': { borderBottom: expanded ? 0 : undefined } }}>
                  <TableCell sx={{ width: 40 }}>
                    <IconButton size="small" onClick={() => toggleExpand(bastion)}>
                      {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => toggleExpand(bastion)}>
                      {bastion.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{bastion.ownerName || '—'}</TableCell>
                  <TableCell>
                    <Chip icon={<ShieldIcon />} label={bastion.facilities.length} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{bastion.treasury} gp</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit bastion">
                      <IconButton size="small" onClick={() => onEdit(bastion)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete bastion">
                      <IconButton size="small" onClick={() => onDelete(bastion)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, borderBottom: expanded ? undefined : 0 }}>
                    <Collapse in={expanded}>
                      <BastionDetailRow
                        bastion={bastion}
                        facilityCatalog={facilityCatalog}
                        onUpdateFacility={onUpdateFacility}
                        onRemoveFacility={onRemoveFacility}
                        onAddFacility={onAddFacility}
                      />
                    </Collapse>
                  </TableCell>
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
