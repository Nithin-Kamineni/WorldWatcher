import { useState } from 'react';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { HOME_WIDGETS, useHomeWidgetsStore } from '../../store/useHomeWidgetsStore';

/** Show/hide switches for each World Home dashboard widget, folded under one row so the
 * Settings list stays short. */
export function HomeWidgetsSettingItem({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const hidden = useHomeWidgetsStore((s) => s.hidden);
  const setWidgetVisible = useHomeWidgetsStore((s) => s.setWidgetVisible);
  const shownCount = HOME_WIDGETS.length - hidden.length;

  return (
    <>
      <ListItemButton onClick={() => setOpen((o) => !o)}>
        <ListItemIcon sx={{ minWidth: 36 }}>
          <DashboardCustomizeOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Home dashboard widgets" secondary="Choose which cards the Home page shows" />
        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
          {shownCount}/{HOME_WIDGETS.length}
        </Typography>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </ListItemButton>
      <Collapse in={open} unmountOnExit>
        <List dense disablePadding sx={{ pl: 6.5, pr: 1, pb: 1 }}>
          {HOME_WIDGETS.map((widget) => {
            const visible = !hidden.includes(widget.id);
            return (
              <ListItem
                key={widget.id}
                disableGutters
                secondaryAction={
                  <Switch
                    size="small"
                    checked={visible}
                    onChange={(e) => setWidgetVisible(widget.id, e.target.checked)}
                    slotProps={{ input: { 'aria-label': `Show the ${widget.label} widget` } }}
                  />
                }
              >
                <ListItemText
                  primary={widget.comingSoon ? `${widget.label} (coming soon)` : widget.label}
                  slotProps={{ primary: { variant: 'body2' } }}
                />
              </ListItem>
            );
          })}
        </List>
      </Collapse>
    </>
  );
}
