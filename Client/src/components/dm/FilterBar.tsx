import type { ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import SearchIcon from '@mui/icons-material/Search';

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  children: ReactNode;
}

export function FilterBar({ search, onSearchChange, searchPlaceholder, hasActiveFilters, onClearFilters, children }: FilterBarProps) {
  return (
    <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <Stack spacing={2}>
        <TextField
          size="small"
          fullWidth
          placeholder={searchPlaceholder ?? 'Search…'}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
          }}
        />
        <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {children}
        </Stack>
        {hasActiveFilters && (
          <Button size="small" onClick={onClearFilters} sx={{ alignSelf: 'flex-start' }}>
            Clear filters
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
