import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import ListItemText from '@mui/material/ListItemText';
import LayersIcon from '@mui/icons-material/Layers';
import { SectionHeader } from '../../shell/SectionHeader';
import type { MapFloor } from '../../../types/map';

interface FloorSwitcherPanelProps {
  floors: MapFloor[];
  activeFloorId: string;
  onSelectFloor: (floorId: string) => void;
}

export function FloorSwitcherPanel({ floors, activeFloorId, onSelectFloor }: FloorSwitcherPanelProps) {
  return (
    <Stack sx={{ height: '100%' }}>
      <SectionHeader icon={<LayersIcon fontSize="small" />} title="Floors" />
      <List sx={{ overflowY: 'auto', px: 1, pt: 1 }}>
        {floors.map((floor) => (
          <ListItemButton
            key={floor.id}
            selected={floor.id === activeFloorId}
            onClick={() => onSelectFloor(floor.id)}
            sx={{ borderRadius: 2, mb: 0.5 }}
          >
            <ListItemAvatar sx={{ minWidth: 48 }}>
              <Avatar variant="rounded" src={floor.imageSrc} alt={floor.name} sx={{ width: 36, height: 36 }} />
            </ListItemAvatar>
            <ListItemText
              primary={floor.name}
              slotProps={{ primary: { noWrap: true, sx: { fontWeight: floor.id === activeFloorId ? 700 : 400 } } }}
            />
          </ListItemButton>
        ))}
      </List>
    </Stack>
  );
}
