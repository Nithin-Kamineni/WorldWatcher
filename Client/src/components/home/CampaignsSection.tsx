import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/EditOutlined';
import CastleIcon from '@mui/icons-material/Castle';
import { useCampaignStore } from '../../store/useCampaignStore';
import { useShellStore } from '../../store/useShellStore';
import { NameDescriptionDialog } from '../shell/NameDescriptionDialog';
import type { Campaign } from '../../types/campaign';

interface CampaignsSectionProps {
  worldId: string;
  worldName: string;
  worldCampaigns: Campaign[];
  /** The campaign currently "active" for this world (useNavMemoryStore) - only this card
   * gets the green selected border/tint, matching WorldCampaignSwitcher's selected-row
   * treatment. Everything else in this section is plain/neutral (issue: the whole section
   * used to be green-tinted, which was wrong). */
  activeCampaignId?: string;
}

/** "Campaigns in this world" - lives at the top of World Home (issue 7a), collapsed by
 * default, and only exposes add/edit affordances while expanded (edit pencil mirrors
 * WorldCampaignSwitcher's per-row pencil). */
export function CampaignsSection({ worldId, worldName, worldCampaigns, activeCampaignId }: CampaignsSectionProps) {
  const navigate = useNavigate();
  const updateCampaign = useCampaignStore((s) => s.updateCampaign);
  const setNewCampaignOpen = useShellStore((s) => s.setNewCampaignDialogOpen);
  const [expanded, setExpanded] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const editingCampaign = worldCampaigns.find((c) => c.id === editingCampaignId);

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3,
        p: 2.5,
        mb: 4,
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <ButtonBase
          onClick={() => setExpanded((e) => !e)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, borderRadius: 2, px: 0.5, py: 0.25 }}
        >
          <ExpandMoreIcon
            sx={{ transition: 'transform 150ms ease', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Campaigns in this world
          </Typography>
          <Chip label={worldCampaigns.length} size="small" variant="outlined" />
        </ButtonBase>
        {expanded && (
          <Button size="small" variant="contained" color="success" startIcon={<AddIcon />} onClick={() => setNewCampaignOpen(true)}>
            New campaign
          </Button>
        )}
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2.5 }}>
          {worldCampaigns.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
              <CastleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No campaigns yet in {worldName}. Start one to unlock Play, Notes, Encounters, and Maps.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
              {worldCampaigns.map((c) => {
                const isSelected = c.id === activeCampaignId;
                return (
                <Box key={c.id} sx={{ position: 'relative' }}>
                  <ButtonBase
                    onClick={() => navigate(`/w/${worldId}/c/${c.id}/home`)}
                    sx={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 3 }}
                  >
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2.5,
                        borderRadius: 3,
                        height: '100%',
                        ...(isSelected && {
                          borderColor: 'success.main',
                          backgroundColor: (theme) => `${theme.palette.success.main}1a`,
                        }),
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, pr: 3 }}>
                        {c.name}
                      </Typography>
                      {c.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                        >
                          {c.description}
                        </Typography>
                      )}
                    </Paper>
                  </ButtonBase>
                  <IconButton
                    size="small"
                    aria-label={`Edit ${c.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCampaignId(c.id);
                    }}
                    sx={{ position: 'absolute', top: 8, right: 8 }}
                  >
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Collapse>

      <NameDescriptionDialog
        open={!!editingCampaign}
        title="Edit campaign"
        submitLabel="Save"
        initialName={editingCampaign?.name ?? ''}
        initialDescription={editingCampaign?.description ?? ''}
        onClose={() => setEditingCampaignId(null)}
        onSubmit={async (name, description) => {
          if (!editingCampaignId) return;
          await updateCampaign(editingCampaignId, { name, description });
          setEditingCampaignId(null);
        }}
      />
    </Paper>
  );
}
