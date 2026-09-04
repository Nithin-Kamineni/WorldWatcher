import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/EditOutlined';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { useWorldStore, getCampaignsForWorld, getWorldById } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';
import { useShellStore } from '../../store/useShellStore';
import { NameDescriptionDialog } from './NameDescriptionDialog';

/** Shown until a world has its own uploaded logo (World.imageSrc, see NameDescriptionDialog's
 * image-upload mode). */
const DEFAULT_WORLD_LOGO = '/world-logo.png';

/** Ellipsis-truncates a name for tight single-line menu real estate - the full name is always
 * still available via Tooltip. */
const truncateSx = { maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const };

interface WorldBrandProps {
  worldId: string;
}

/** Logo + world name, plain (no border/chevron) - this is the "brand" corner of the navbar, kept
 * visually separate from CampaignSwitcher per the reference layout. Still opens a menu to jump
 * back to the Dashboard or switch worlds; long names wrap onto a second line instead of
 * ellipsis-truncating, matching the reference screenshot. */
export function WorldBrand({ worldId }: WorldBrandProps) {
  const navigate = useNavigate();
  const worlds = useWorldStore((s) => s.worlds);
  const fetchWorlds = useWorldStore((s) => s.fetchWorlds);

  useEffect(() => {
    fetchWorlds();
  }, [fetchWorlds]);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const world = getWorldById(worlds, worldId);

  return (
    <>
      <Tooltip title="Switch world">
        <ButtonBase
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1,
            py: 0.5,
            borderRadius: 2,
            minWidth: 0,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Box
            component="img"
            src={world?.imageSrc || DEFAULT_WORLD_LOGO}
            alt=""
            sx={{ width: 30, height: 30, borderRadius: 0.85, objectFit: 'cover', flexShrink: 0 }}
          />
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              textAlign: 'left',
              lineHeight: 1.15,
              maxWidth: 160,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {world?.name ?? '…'}
          </Typography>
        </ButtonBase>
      </Tooltip>

      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)} slotProps={{ paper: { sx: { maxWidth: 300 } } }}>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            navigate('/dashboard');
          }}
        >
          <DashboardIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
          Dashboard
        </MenuItem>
        <Divider />
        <ListSubheader disableSticky sx={{ lineHeight: 2.5 }}>
          Worlds
        </ListSubheader>
        {worlds.map((w) => (
          <MenuItem
            key={w.id}
            selected={w.id === worldId}
            onClick={() => {
              setAnchorEl(null);
              navigate(`/w/${w.id}/home`);
            }}
          >
            <Tooltip title={w.name} enterDelay={500}>
              <Typography variant="body2" sx={truncateSx}>
                {w.name}
              </Typography>
            </Tooltip>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

interface CampaignSwitcherProps {
  worldId: string;
  campaignId?: string;
}

/** Bordered "Campaign — name" pill with its own dropdown, standing in the spot a reference
 * "Session — <date>" picker would occupy - separate from WorldBrand so the world and the active
 * campaign each get their own clear affordance instead of one merged/cramped control. */
export function CampaignSwitcher({ worldId, campaignId }: CampaignSwitcherProps) {
  const navigate = useNavigate();
  const worlds = useWorldStore((s) => s.worlds);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const updateCampaign = useCampaignStore((s) => s.updateCampaign);
  const setNewCampaignOpen = useShellStore((s) => s.setNewCampaignDialogOpen);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const world = getWorldById(worlds, worldId);
  const campaign = getCampaignById(campaigns, campaignId);
  const worldCampaigns = getCampaignsForWorld(campaigns, worldId);
  const editingCampaign = getCampaignById(campaigns, editingCampaignId ?? undefined);

  const label = campaign?.name ?? (worldCampaigns.length === 0 ? 'No campaigns yet' : 'Select campaign');

  return (
    <>
      <Tooltip title={campaign ? campaign.name : label}>
        <ButtonBase
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.5,
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            minWidth: 0,
            color: campaign ? 'text.primary' : 'text.secondary',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <AutoStoriesIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
          <Typography variant="body2" sx={{ fontWeight: 600, ...truncateSx }}>
            {label}
          </Typography>
          <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.disabled', ml: 0.5, flexShrink: 0 }} />
        </ButtonBase>
      </Tooltip>

      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)} slotProps={{ paper: { sx: { maxWidth: 300 } } }}>
        <ListSubheader disableSticky sx={{ lineHeight: 2.5, ...truncateSx, maxWidth: 280 }}>
          Campaigns in {world?.name}
        </ListSubheader>
        {worldCampaigns.length === 0 && <MenuItem disabled>No campaigns yet</MenuItem>}
        {worldCampaigns.map((c) => {
          const isSelected = c.id === campaignId;
          return (
            <MenuItem
              key={c.id}
              onClick={() => {
                setAnchorEl(null);
                navigate(`/w/${worldId}/c/${c.id}/home`);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mx: 0.5,
                borderRadius: 1,
                ...(isSelected && {
                  border: 1,
                  borderColor: 'success.main',
                  backgroundColor: (theme) => `${theme.palette.success.main}1a`,
                }),
              }}
            >
              {isSelected ? (
                <CheckCircleIcon fontSize="small" color="success" />
              ) : (
                <Box sx={{ width: 20, flexShrink: 0 }} />
              )}
              <Tooltip title={c.name} enterDelay={500}>
                <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0, ...truncateSx, maxWidth: 'none' }}>
                  {c.name}
                </Typography>
              </Tooltip>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setAnchorEl(null);
                  setEditingCampaignId(c.id);
                }}
              >
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setNewCampaignOpen(true);
          }}
        >
          <AddIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
          New campaign
        </MenuItem>
      </Menu>

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
    </>
  );
}
