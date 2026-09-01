import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ConstructionIcon from '@mui/icons-material/Construction';

interface ComingSoonProps {
  title: string;
  description: string;
  icon?: ReactNode;
  planned?: string[];
  note?: string;
}

/** Standard empty-state panel for any section in the new IA that doesn't have a
 * working feature behind it yet - see Prompt Images/WorldWatcher UI redisgn.md
 * for what each of these is planned to become. */
export function ComingSoon({ title, description, icon, planned, note }: ComingSoonProps) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 8,
        px: 3,
        borderRadius: 4,
        border: '1px dashed',
        borderColor: 'divider',
        maxWidth: 520,
        mx: 'auto',
      }}
    >
      <Box sx={{ mb: 1, color: 'text.disabled' }}>{icon ?? <ConstructionIcon sx={{ fontSize: 56 }} />}</Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: planned ? 2 : 0 }}>
        {description}
      </Typography>
      {planned && planned.length > 0 && (
        <List dense sx={{ textAlign: 'left', display: 'inline-block' }}>
          {planned.map((item) => (
            <ListItem key={item} disableGutters sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <FiberManualRecordIcon sx={{ fontSize: 6 }} />
              </ListItemIcon>
              <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }} />
            </ListItem>
          ))}
        </List>
      )}
      {note && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, fontStyle: 'italic' }}>
          {note}
        </Typography>
      )}
    </Box>
  );
}
