import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import PublicIcon from '@mui/icons-material/Public';
import MapIcon from '@mui/icons-material/Map';
import EditIcon from '@mui/icons-material/EditOutlined';
import { TopBar } from '../components/shell/TopBar';
import { CommandPalette } from '../components/shell/CommandPalette';
import { NameDescriptionDialog } from '../components/shell/NameDescriptionDialog';
import { useWorldStore, getCampaignsForWorld } from '../store/useWorldStore';
import { useCampaignStore } from '../store/useCampaignStore';
import { useFactionStore, getFactionsForCampaign } from '../store/useFactionStore';
import { useCreatureStore, getCreaturesForCampaign } from '../store/useCreatureStore';
import { useShellStore } from '../store/useShellStore';
import { useNavMemoryStore } from '../store/useNavMemoryStore';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import { SectionTitle } from '../components/shell/PageTitle';

export function DashboardPage() {
  const navigate = useNavigate();
  const worlds = useWorldStore((s) => s.worlds);
  const worldsLoading = useWorldStore((s) => s.worldsLoading);
  const worldsLoaded = useWorldStore((s) => s.worldsLoaded);
  const fetchWorlds = useWorldStore((s) => s.fetchWorlds);
  const updateWorld = useWorldStore((s) => s.updateWorld);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const lastLocation = useNavMemoryStore((s) => s.lastLocation);
  const lastVisitedMap = useNavMemoryStore((s) => s.lastVisitedMap);
  const setNewWorldOpen = useShellStore((s) => s.setNewWorldDialogOpen);

  const factionsByCampaignId = useFactionStore((s) => s.factionsByCampaignId);
  const fetchFactionsForCampaign = useFactionStore((s) => s.fetchFactionsForCampaign);
  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);

  const [editingWorldId, setEditingWorldId] = useState<string | null>(null);
  const editingWorld = worlds.find((w) => w.id === editingWorldId);

  useEffect(() => {
    fetchWorlds();
    fetchCampaigns();
  }, [fetchWorlds, fetchCampaigns]);

  useEffect(() => {
    campaigns.slice(0, 5).forEach((c) => {
      fetchFactionsForCampaign(c.id);
      fetchCreaturesForCampaign(c.id);
    });
  }, [campaigns, fetchFactionsForCampaign, fetchCreaturesForCampaign]);

  const recentlyEdited = campaigns
    .flatMap((c) => [
      ...getFactionsForCampaign(factionsByCampaignId, c.id).map((f) => ({ id: f.id, name: f.name, updatedAt: f.updatedAt, worldId: c.worldId })),
      ...getCreaturesForCampaign(creaturesByCampaignId, c.id)
        .filter((cr) => cr.category === 'npc')
        .map((n) => ({ id: n.id, name: n.name, updatedAt: n.updatedAt, worldId: c.worldId })),
    ])
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar />
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 2, sm: 4 } }}>
        <Box sx={{ maxWidth: 960, mx: 'auto' }}>
          {lastLocation && (
            <Paper
              variant="outlined"
              sx={{ p: 3, borderRadius: 3, mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: 'primary.main' }}
            >
              <Box>
                <Typography variant="overline" color="primary.main">
                  Resume
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {lastLocation.campaignName ?? lastLocation.worldName} — {lastLocation.sectionLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  last visited {formatRelativeTime(lastLocation.visitedAt)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.5}>
                {lastVisitedMap && (
                  <Tooltip title={`Jump straight to ${lastVisitedMap.mapName}`}>
                    <Button
                      variant="outlined"
                      color="success"
                      size="large"
                      startIcon={<MapIcon />}
                      onClick={() => navigate(`/w/${lastVisitedMap.worldId}/c/${lastVisitedMap.campaignId}/maps/${lastVisitedMap.mapId}`)}
                    >
                      Maps
                    </Button>
                  </Tooltip>
                )}
                <Button variant="contained" size="large" startIcon={<PlayArrowIcon />} onClick={() => navigate(lastLocation.path)}>
                  Continue
                </Button>
              </Stack>
            </Paper>
          )}

          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <SectionTitle>Your worlds</SectionTitle>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewWorldOpen(true)}>
              New world
            </Button>
          </Stack>

          {worldsLoading && !worldsLoaded ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : worlds.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
              <PublicIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No worlds yet. Create one to start building your setting.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2, mb: 5 }}>
              {worlds.map((world) => {
                const worldCampaigns = getCampaignsForWorld(campaigns, world.id);
                return (
                  <Box key={world.id} sx={{ position: 'relative' }}>
                    <ButtonBase onClick={() => navigate(`/w/${world.id}/home`)} sx={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 3 }}>
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, pr: 3 }}>
                          {world.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                          {worldCampaigns.length} campaign{worldCampaigns.length === 1 ? '' : 's'}
                        </Typography>
                        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                          {worldCampaigns.slice(0, 4).map((c) => (
                            <Chip key={c.id} label={c.name} size="small" onClick={(e) => { e.stopPropagation(); navigate(`/w/${world.id}/c/${c.id}/home`); }} />
                          ))}
                        </Stack>
                      </Paper>
                    </ButtonBase>
                    <IconButton
                      size="small"
                      aria-label={`Edit ${world.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingWorldId(world.id);
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

          {recentlyEdited.length > 0 && (
            <>
              <SectionTitle sx={{ mb: 1.5 }}>Recently edited</SectionTitle>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {recentlyEdited.map((item) => (
                  <Chip key={item.id} label={item.name} onClick={() => navigate(`/w/${item.worldId}/manager`)} />
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Box>

      <NameDescriptionDialog
        open={!!editingWorld}
        title="Edit world"
        submitLabel="Save"
        imageUpload
        initialName={editingWorld?.name ?? ''}
        initialDescription={editingWorld?.description ?? ''}
        initialImageUrl={editingWorld?.imageSrc}
        onClose={() => setEditingWorldId(null)}
        onSubmit={async (name, description, imageAssetId) => {
          if (!editingWorldId) return;
          await updateWorld(editingWorldId, { name, description, imageAssetId });
          setEditingWorldId(null);
        }}
      />

      <CommandPalette />
    </Box>
  );
}
