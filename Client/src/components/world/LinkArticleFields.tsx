import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';

interface LinkArticleFieldsProps {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  createNow: boolean;
  onCreateNowChange: (value: boolean) => void;
}

/** The "also create a world article for this" checkbox pair (issue 4c/4h) - reused by the 4
 * entity FormDialogs (NpcFormDialog/CreatureFormDialog/SpellFormDialog/MagicItemFormDialog).
 * Only render this when in create mode AND a world is actually in scope - callers own that
 * decision, this component just renders the two checkboxes. */
export function LinkArticleFields({ checked, onCheckedChange, createNow, onCreateNowChange }: LinkArticleFieldsProps) {
  return (
    <Stack spacing={0}>
      <FormControlLabel
        control={<Checkbox checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />}
        label="Also create a world article for this"
      />
      {checked && (
        <FormControlLabel
          sx={{ ml: 3 }}
          control={<Checkbox checked={createNow} onChange={(e) => onCreateNowChange(e.target.checked)} />}
          label="Create the article now (otherwise it's left blank for later)"
        />
      )}
    </Stack>
  );
}
