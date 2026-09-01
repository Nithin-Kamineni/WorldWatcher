import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ReactElement } from 'react';
import Popper from '@mui/material/Popper';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PersonIcon from '@mui/icons-material/Person';
import PetsIcon from '@mui/icons-material/Pets';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import PlaceIcon from '@mui/icons-material/Place';
import GroupsIcon from '@mui/icons-material/Groups';
import TableChartIcon from '@mui/icons-material/TableChart';
import type { EntityRefType } from '../../utils/bbcode';
import type { MentionableEntity } from '../../hooks/useMentionableEntities';

const CATEGORY_META: Record<EntityRefType, { label: string; icon: ReactElement }> = {
  npc: { label: 'NPCs', icon: <PersonIcon fontSize="small" /> },
  creature: { label: 'Creatures', icon: <PetsIcon fontSize="small" /> },
  spell: { label: 'Spells', icon: <AutoFixHighIcon fontSize="small" /> },
  encounter: { label: 'Encounters', icon: <WhatshotIcon fontSize="small" /> },
  place: { label: 'Places', icon: <PlaceIcon fontSize="small" /> },
  faction: { label: 'Factions', icon: <GroupsIcon fontSize="small" /> },
  situational_table: { label: 'Tables', icon: <TableChartIcon fontSize="small" /> },
};

const CATEGORY_ORDER: EntityRefType[] = ['npc', 'creature', 'spell', 'encounter', 'place', 'faction', 'situational_table'];

export interface MentionPickerHandle {
  moveHighlight: (delta: number) => void;
  confirmHighlighted: () => boolean;
}

interface MentionPickerProps {
  open: boolean;
  anchorPosition: { top: number; left: number; height: number } | null;
  query: string;
  entities: MentionableEntity[];
  onSelect: (entity: MentionableEntity) => void;
  onClose: () => void;
}

/** Floating @-mention search popover - anchored at the caret position where "@" was typed
 * (BBCodeEditor computes this via getCaretCoordinates). Filtering is driven entirely by the
 * `@query` text typed directly in the textarea (like Slack/GitHub mentions) plus an optional
 * category chip click, so focus never has to leave the textarea while typing. Keyboard
 * navigation (Up/Down/Enter/Escape) is handled by BBCodeEditor's textarea keydown listener via
 * the imperative handle, for the same reason. */
export const MentionPicker = forwardRef<MentionPickerHandle, MentionPickerProps>(function MentionPicker(
  { open, anchorPosition, query, entities, onSelect, onClose },
  ref,
) {
  const [category, setCategory] = useState<'all' | EntityRefType>('all');
  const [highlighted, setHighlighted] = useState(0);

  const availableCategories = useMemo(() => {
    const present = new Set(entities.map((e) => e.type));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [entities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entities
      .filter((e) => category === 'all' || e.type === category)
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [entities, category, query]);

  useEffect(() => {
    setHighlighted(0);
  }, [query, category, open]);

  useEffect(() => {
    if (!open) setCategory('all');
  }, [open]);

  useImperativeHandle(
    ref,
    () => ({
      moveHighlight: (delta) => {
        setHighlighted((h) => {
          if (filtered.length === 0) return 0;
          return (h + delta + filtered.length) % filtered.length;
        });
      },
      confirmHighlighted: () => {
        const picked = filtered[highlighted];
        if (picked) {
          onSelect(picked);
          return true;
        }
        return false;
      },
    }),
    [filtered, highlighted, onSelect],
  );

  if (!open || !anchorPosition) return null;

  const virtualAnchor = {
    getBoundingClientRect: () =>
      new DOMRect(anchorPosition.left, anchorPosition.top, 0, anchorPosition.height),
  };

  return (
    <Popper
      open={open}
      anchorEl={virtualAnchor}
      placement="bottom-start"
      disablePortal={false}
      sx={{ zIndex: (t) => t.zIndex.modal + 1 }}
    >
      <ClickAwayListener onClickAway={onClose}>
        <Paper
          variant="outlined"
          sx={{ width: 320, maxHeight: 360, display: 'flex', flexDirection: 'column', borderRadius: 2, overflow: 'hidden', boxShadow: 6, mt: 0.5 }}
          // Keep focus (and the caret) in the textarea - clicking chips/items must not steal it.
          onMouseDown={(e) => e.preventDefault()}
        >
          <Stack direction="row" spacing={0.5} sx={{ px: 1, py: 1, flexWrap: 'wrap', gap: 0.5, borderBottom: 1, borderColor: 'divider' }}>
            <Chip
              label="All"
              size="small"
              color={category === 'all' ? 'primary' : 'default'}
              variant={category === 'all' ? 'filled' : 'outlined'}
              onClick={() => setCategory('all')}
            />
            {availableCategories.map((c) => (
              <Chip
                key={c}
                icon={CATEGORY_META[c].icon}
                label={CATEGORY_META[c].label}
                size="small"
                color={category === c ? 'primary' : 'default'}
                variant={category === c ? 'filled' : 'outlined'}
                onClick={() => setCategory(c)}
              />
            ))}
          </Stack>

          <Box sx={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                {query ? `No matches for "${query}"` : 'No entities to mention yet'}
              </Typography>
            ) : (
              <MenuList dense sx={{ py: 0.5 }}>
                {filtered.map((entity, index) => (
                  <MenuItem
                    key={`${entity.type}-${entity.id}`}
                    selected={index === highlighted}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => onSelect(entity)}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>{CATEGORY_META[entity.type].icon}</ListItemIcon>
                    <ListItemText
                      primary={entity.name}
                      secondary={entity.subtitle}
                      slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
                    />
                  </MenuItem>
                ))}
              </MenuList>
            )}
          </Box>
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
});
