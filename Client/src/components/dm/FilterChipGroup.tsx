import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

interface ChipOption {
  value: string;
  label: string;
}

interface FilterChipGroupProps {
  label: string;
  options: ChipOption[];
  selected: string[];
  onToggle: (value: string) => void;
}

export function FilterChipGroup({ label, options, selected, onToggle }: FilterChipGroupProps) {
  if (options.length === 0) return null;
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            size="small"
            color={selected.includes(option.value) ? 'primary' : 'default'}
            variant={selected.includes(option.value) ? 'filled' : 'outlined'}
            onClick={() => onToggle(option.value)}
          />
        ))}
      </Stack>
    </Stack>
  );
}
