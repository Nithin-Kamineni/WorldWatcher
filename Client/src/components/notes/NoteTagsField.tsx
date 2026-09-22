import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';

/** The free-text tag list used by every Note editor - the text one's "More options" and the
 * canvas ones' options popover - so a whiteboard and a written page are tagged the same way.
 * (Articles and Factions still each carry their own copy of this field; folding those in is a
 * separate cleanup, not part of adding the canvas note types.) */
export function NoteTagsField({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <Autocomplete<string, true, false, true>
      multiple
      freeSolo
      options={[]}
      value={value}
      onChange={(_e, next) => onChange(next as string[])}
      renderValue={(vals, getItemProps) => vals.map((tag, index) => <Chip label={tag} size="small" {...getItemProps({ index })} key={tag} />)}
      renderInput={(params) => <TextField {...params} label="Tags" placeholder="Type and press Enter" />}
    />
  );
}
