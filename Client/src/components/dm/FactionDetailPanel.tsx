import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import { TokenThumbnail } from '../map/TokenThumbnail';
import { RELATION_TYPE_META, type FactionRelation } from '../../types/factionRelation';
import type { Faction } from '../../types/faction';

interface FactionDetailPanelProps {
  center: Faction;
  selected: Faction;
  relation: FactionRelation | undefined;
  onClose: () => void;
  onEditRelation: () => void;
}

function ComparisonBar({
  label,
  centerValue,
  selectedValue,
  centerName,
  selectedName,
  maxValue = 100,
}: {
  label: string;
  centerValue: number;
  selectedValue: number;
  centerName: string;
  selectedName: string;
  maxValue?: number;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Typography>
      {[
        { name: centerName, value: centerValue, color: 'primary.main' },
        { name: selectedName, value: selectedValue, color: 'info.main' },
      ].map((row) => (
        <Stack key={row.name} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" sx={{ width: 84, flexShrink: 0 }} noWrap>
            {row.name}
          </Typography>
          <Box sx={{ flexGrow: 1, height: 8, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${Math.max(2, Math.min(100, (row.value / maxValue) * 100))}%`,
                bgcolor: row.color,
                borderRadius: 4,
                transition: 'width 240ms ease',
              }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ width: 24, textAlign: 'right' }}>
            {row.value}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

export function FactionDetailPanel({ center, selected, relation, onClose, onEditRelation }: FactionDetailPanelProps) {
  const meta = relation ? RELATION_TYPE_META[relation.type] : RELATION_TYPE_META.neutral;

  return (
    <Paper
      elevation={6}
      sx={{
        width: 300,
        flexShrink: 0,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="overline" color="text.secondary">
            Diplomatic status
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <TokenThumbnail src={selected.imageSrc} name={selected.name} size={48} border="2px solid" />
          <Stack sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
              {selected.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              vs. {center.name}
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1.5 }}>
          <Chip
            label={meta.label}
            size="small"
            sx={{ bgcolor: meta.color, color: '#fff', fontWeight: 700 }}
          />
          <Tooltip title="Edit relation">
            <IconButton size="small" onClick={onEditRelation}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Stack spacing={2} sx={{ p: 2 }}>
        {relation && relation.treaties.length > 0 && (
          <Stack spacing={0.75}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
              TREATIES
            </Typography>
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {relation.treaties.map((t) => (
                <Chip key={t} label={t} size="small" variant="outlined" />
              ))}
            </Stack>
          </Stack>
        )}

        {relation?.notes && (
          <Typography variant="body2" color="text.secondary">
            {relation.notes}
          </Typography>
        )}

        <ComparisonBar
          label="Power"
          centerValue={center.power}
          selectedValue={selected.power}
          centerName={center.name}
          selectedName={selected.name}
          maxValue={Math.max(center.power, selected.power) * 1.2}
        />
        <ComparisonBar
          label="Military strength"
          centerValue={center.military}
          selectedValue={selected.military}
          centerName={center.name}
          selectedName={selected.name}
        />
        <ComparisonBar
          label="Naval strength"
          centerValue={center.naval}
          selectedValue={selected.naval}
          centerName={center.name}
          selectedName={selected.name}
        />
        <ComparisonBar
          label="Economic strength"
          centerValue={center.economy}
          selectedValue={selected.economy}
          centerName={center.name}
          selectedName={selected.name}
        />
        <ComparisonBar
          label="Reputation / prestige"
          centerValue={center.reputation}
          selectedValue={selected.reputation}
          centerName={center.name}
          selectedName={selected.name}
        />
      </Stack>
    </Paper>
  );
}
