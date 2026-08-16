import { useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LayersIcon from '@mui/icons-material/Layers';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { getMapKindOption, getPrimaryFloor, type MapData } from '../../types/map';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import { MapPreviewPopper } from './MapPreviewPopper';
import { MapDetailsDialog } from './MapDetailsDialog';

interface MapsTableProps {
  maps: MapData[];
  onOpen: (map: MapData) => void;
  onEdit: (map: MapData) => void;
  onDelete: (map: MapData) => void;
}

export function MapsTable({ maps, onOpen, onEdit, onDelete }: MapsTableProps) {
  const [hoveredMap, setHoveredMap] = useState<MapData | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [detailsMap, setDetailsMap] = useState<MapData | null>(null);

  const handleMouseEnter = (event: React.MouseEvent<HTMLElement>, map: MapData) => {
    setAnchorEl(event.currentTarget);
    setHoveredMap(map);
  };

  const handleMouseLeave = () => {
    setHoveredMap(null);
    setAnchorEl(null);
  };

  return (
    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 700 }}>Map</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Floors</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Updated</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {maps.map((map) => {
            const primaryFloor = getPrimaryFloor(map);
            return (
              <TableRow
                key={map.id}
                hover
                sx={{ '&:last-child td': { borderBottom: 0 } }}
              >
                <TableCell sx={{ maxWidth: 360 }}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Box
                      onMouseEnter={(e) => handleMouseEnter(e, map)}
                      onMouseLeave={handleMouseLeave}
                      component="img"
                      src={primaryFloor?.imageSrc}
                      alt={map.name}
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        objectFit: 'cover',
                        flexShrink: 0,
                        border: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                        onClick={() => onOpen(map)}
                        noWrap
                      >
                        {map.name}
                      </Typography>
                      {map.description && (
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {map.description}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </TableCell>

                <TableCell>
                  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', maxWidth: 220 }}>
                    {map.kinds.map((kind) => {
                      const option = getMapKindOption(kind);
                      return <Chip key={kind} label={option.label} color={option.color} size="small" />;
                    })}
                  </Stack>
                </TableCell>

                <TableCell>
                  <Chip
                    icon={<LayersIcon />}
                    label={`${map.floors.length} floor${map.floors.length === 1 ? '' : 's'}`}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>

                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatRelativeTime(map.updatedAt)}
                  </Typography>
                </TableCell>

                <TableCell align="right">
                  <Tooltip title="Open map">
                    <IconButton size="small" onClick={() => onOpen(map)}>
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="More info">
                    <IconButton size="small" onClick={() => setDetailsMap(map)}>
                      <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit map">
                    <IconButton size="small" onClick={() => onEdit(map)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete map">
                    <IconButton size="small" onClick={() => onDelete(map)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <MapPreviewPopper
        open={!!hoveredMap}
        anchorEl={anchorEl}
        mapName={hoveredMap?.name ?? ''}
        floors={hoveredMap?.floors ?? []}
        primaryFloorId={hoveredMap?.primaryFloorId ?? ''}
      />
      <MapDetailsDialog open={!!detailsMap} map={detailsMap} onClose={() => setDetailsMap(null)} />
    </TableContainer>
  );
}
