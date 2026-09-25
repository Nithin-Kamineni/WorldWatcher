import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { TokenThumbnail } from '../map/TokenThumbnail';
import { RELATION_TYPE_META, type FactionRelation } from '../../types/factionRelation';
import type { Faction } from '../../types/faction';

interface FactionDetailPanelProps {
  center: Faction;
  selected: Faction;
  relation: FactionRelation | undefined;
  onClose: () => void;
  onEditRelation: () => void;
  /** Opens the full read-only card for `selected`. This panel only ever shows the *pair's*
   * diplomatic status, so without this the graph gives no way to see one faction's own
   * details - the table's name/eye actions were the only entry points. */
  onViewCard?: () => void;
}

/** The two sides are named ONCE, in the legend above the bars, rather than on all ten bar
 * rows - at 84px every row read "Confederacy of Indep…", which told you nothing and cost the
 * bars a third of their width. Colour carries the identity instead. */
function ComparisonLegend({ centerName, selectedName }: { centerName: string; selectedName: string }) {
  return (
    <Stack spacing={0.25}>
      {[
        { name: centerName, color: 'primary.main' },
        { name: selectedName, color: 'info.main' },
      ].map((row) => (
        <Stack key={row.name} direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.color, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
            {row.name}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function ComparisonBar({
  label,
  centerValue,
  selectedValue,
  maxValue = 100,
}: {
  label: string;
  centerValue: number;
  selectedValue: number;
  maxValue?: number;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Typography>
      {[
        { key: 'center', value: centerValue, color: 'primary.main' },
        { key: 'selected', value: selectedValue, color: 'info.main' },
      ].map((row) => (
        <Stack key={row.key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
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

export function FactionDetailPanel({ center, selected, relation, onClose, onEditRelation, onViewCard }: FactionDetailPanelProps) {
  const meta = relation ? RELATION_TYPE_META[relation.type] : RELATION_TYPE_META.neutral;

  return (
    <Paper
      elevation={6}
      sx={{
        width: '100%',
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
          {onViewCard && (
            <Tooltip title={`View ${selected.name} card`}>
              <IconButton size="small" onClick={onViewCard}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>

      <Stack spacing={2} sx={{ p: 2 }}>
        <ComparisonLegend centerName={center.name} selectedName={selected.name} />

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
          maxValue={Math.max(center.power, selected.power) * 1.2}
        />
        <ComparisonBar
          label="Military strength"
          centerValue={center.military}
          selectedValue={selected.military}
        />
        <ComparisonBar
          label="Naval strength"
          centerValue={center.naval}
          selectedValue={selected.naval}
        />
        <ComparisonBar
          label="Economic strength"
          centerValue={center.economy}
          selectedValue={selected.economy}
        />
        <ComparisonBar
          label="Reputation / prestige"
          centerValue={center.reputation}
          selectedValue={selected.reputation}
        />
      </Stack>
    </Paper>
  );
}
