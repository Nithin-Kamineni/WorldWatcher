import { useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import VisibilityIcon from '@mui/icons-material/Visibility';
import type { BastionFacility } from '../../types/bastion';
import { BastionFacilityDetailDialog } from './BastionFacilityDetailDialog';
import { ImagePreviewPopper } from './ImagePreviewPopper';
import { TokenThumbnail } from '../map/TokenThumbnail';

interface BastionFacilitiesTableProps {
  facilities: BastionFacility[];
}

export function BastionFacilitiesTable({ facilities }: BastionFacilitiesTableProps) {
  const [viewingFacility, setViewingFacility] = useState<BastionFacility | null>(null);
  const [hoveredFacility, setHoveredFacility] = useState<BastionFacility | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleMouseEnter = (event: React.MouseEvent<HTMLElement>, facility: BastionFacility) => {
    if (!facility.imageSrc) return;
    setAnchorEl(event.currentTarget);
    setHoveredFacility(facility);
  };

  const handleMouseLeave = () => {
    setHoveredFacility(null);
    setAnchorEl(null);
  };

  return (
    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 700 }} />
            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Space</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Prerequisite Level</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {facilities.map((facility) => (
            <TableRow key={facility.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
              <TableCell sx={{ width: 56 }}>
                <Box
                  onMouseEnter={(e) => handleMouseEnter(e, facility)}
                  onMouseLeave={handleMouseLeave}
                  sx={{ display: 'inline-flex', cursor: facility.imageSrc ? 'pointer' : undefined }}
                >
                  <TokenThumbnail src={facility.imageSrc} name={facility.name} size={40} />
                </Box>
              </TableCell>
              <TableCell>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  onClick={() => setViewingFacility(facility)}
                >
                  {facility.name}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={facility.facilityType === 'special' ? 'Special' : 'Basic'}
                  size="small"
                  color={facility.facilityType === 'special' ? 'secondary' : 'default'}
                />
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {facility.space.map((s) => (
                    <Chip key={s} label={s} size="small" variant="outlined" />
                  ))}
                </Stack>
              </TableCell>
              <TableCell>{facility.prerequisiteLevel ?? '—'}</TableCell>
              <TableCell align="right">
                <Tooltip title="View details">
                  <IconButton size="small" onClick={() => setViewingFacility(facility)}>
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ImagePreviewPopper
        open={!!hoveredFacility}
        anchorEl={anchorEl}
        name={hoveredFacility?.name ?? ''}
        imageSrc={hoveredFacility?.imageSrc ?? ''}
      />
      <BastionFacilityDetailDialog open={!!viewingFacility} facility={viewingFacility} onClose={() => setViewingFacility(null)} />
    </TableContainer>
  );
}
