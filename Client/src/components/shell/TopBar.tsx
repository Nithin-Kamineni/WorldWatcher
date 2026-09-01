import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import MapIcon from '@mui/icons-material/Map';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import { WorldBrand, CampaignSwitcher } from './WorldCampaignSwitcher';
import { NameDescriptionDialog } from './NameDescriptionDialog';
import { PlayLayoutControls } from '../play/layout/PlayLayoutControls';
import { useThemeMode } from '../../theme/ThemeModeContext';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useShellStore } from '../../store/useShellStore';
import { useNavMemoryStore } from '../../store/useNavMemoryStore';
import { useWorldStore } from '../../store/useWorldStore';
import { useCampaignStore } from '../../store/useCampaignStore';
import { usePlayUiStore, getPlayState } from '../../store/usePlayUiStore';
import { usePlayLayoutStore, getPlayLayoutState } from '../../store/usePlayLayoutStore';

export const TOP_BAR_HEIGHT = 56;

interface TopBarProps {
  worldId?: string;
  campaignId?: string;
}

export function TopBar({ worldId, campaignId }: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleMode } = useThemeMode();
  const startTutorial = useTutorialStore((s) => s.start);
  const setPaletteOpen = useShellStore((s) => s.setPaletteOpen);
  const lastVisitedMap = useNavMemoryStore((s) => s.lastVisitedMap);
  const newWorldOpen = useShellStore((s) => s.newWorldDialogOpen);
  const setNewWorldOpen = useShellStore((s) => s.setNewWorldDialogOpen);
  const newCampaignOpen = useShellStore((s) => s.newCampaignDialogOpen);
  const setNewCampaignOpen = useShellStore((s) => s.setNewCampaignDialogOpen);
  const addWorld = useWorldStore((s) => s.addWorld);
  const addCampaign = useCampaignStore((s) => s.addCampaign);

  const playByCampaignId = usePlayUiStore((s) => s.byCampaignId);
  const endSession = usePlayUiStore((s) => s.endSession);
  const layoutByCampaignId = usePlayLayoutStore((s) => s.byCampaignId);
  const setLayout = usePlayLayoutStore((s) => s.setLayout);
  const toggleLock = usePlayLayoutStore((s) => s.toggleLock);
  const resetLayout = usePlayLayoutStore((s) => s.resetLayout);

  const inPlaySession = !!campaignId && location.pathname.endsWith('/play') && !!getPlayState(playByCampaignId, campaignId).sessionNoteId;
  const layoutState = campaignId ? getPlayLayoutState(layoutByCampaignId, campaignId) : null;

  const [newMenuAnchor, setNewMenuAnchor] = useState<HTMLElement | null>(null);
  const [runMenuAnchor, setRunMenuAnchor] = useState<HTMLElement | null>(null);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);

  const goCreate = (path: string) => {
    setNewMenuAnchor(null);
    navigate(`${path}${path.includes('?') ? '&' : '?'}new=1`);
  };

  return (
    <>
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Toolbar variant="dense" sx={{ height: TOP_BAR_HEIGHT, minHeight: `${TOP_BAR_HEIGHT}px !important`, gap: 1.5 }}>
          <Box data-tour="navbar-brand">
            {worldId ? (
              <WorldBrand worldId={worldId} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box component="img" src="/app-icon.png" alt="" sx={{ width: 26, height: 26, borderRadius: 1, objectFit: 'cover' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  WorldWatcher
                </Typography>
              </Box>
            )}
          </Box>

          {worldId && <CampaignSwitcher worldId={worldId} campaignId={campaignId} />}

          <ButtonBase
            onClick={() => setPaletteOpen(true)}
            sx={{
              flexGrow: 1,
              maxWidth: 480,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              color: 'text.secondary',
              justifyContent: 'flex-start',
            }}
          >
            <SearchIcon fontSize="small" />
            <Typography variant="body2" sx={{ flexGrow: 1, textAlign: 'left' }}>
              Ask or search anything…
            </Typography>
            <Box
              sx={{
                fontSize: 11,
                border: 1,
                borderColor: 'divider',
                borderRadius: 0.75,
                px: 0.5,
                color: 'text.secondary',
              }}
            >
              Ctrl K
            </Box>
          </ButtonBase>

          <Box sx={{ flexGrow: 1 }} />

          {inPlaySession && campaignId && layoutState ? (
            <>
              <Tooltip title="Back to session setup">
                <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => endSession(campaignId)}>
                  Change Session
                </Button>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
              <PlayLayoutControls
                layoutId={layoutState.layoutId}
                locked={layoutState.locked}
                onSelectLayout={(id) => setLayout(campaignId, id)}
                onToggleLock={() => toggleLock(campaignId)}
                onResetLayout={() => resetLayout(campaignId)}
              />
            </>
          ) : (
            <>
              {worldId && (
                <Tooltip title="Create new">
                  <ButtonBase
                    onClick={(e) => setNewMenuAnchor(e.currentTarget)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: 'divider',
                      pl: 0.75,
                      pr: 0.25,
                      py: 0.5,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <AddIcon fontSize="small" />
                    <ArrowDropDownIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </ButtonBase>
                </Tooltip>
              )}

              <Tooltip title={lastVisitedMap ? `Resume ${lastVisitedMap.mapName}` : 'Run - jump into Play or Maps'}>
                <span>
                  <ButtonBase
                    onClick={(e) => setRunMenuAnchor(e.currentTarget)}
                    disabled={!campaignId && !lastVisitedMap}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: 'divider',
                      pl: 0.75,
                      pr: 0.25,
                      py: 0.5,
                      color: 'success.main',
                      '&:hover': { bgcolor: 'action.hover' },
                      '&.Mui-disabled': { opacity: 0.4 },
                    }}
                  >
                    <PlayArrowIcon fontSize="small" />
                    <ArrowDropDownIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </ButtonBase>
                </span>
              </Tooltip>
            </>
          )}

          <IconButton onClick={toggleMode} size="small" aria-label="Toggle light/dark mode" data-tour="theme-toggle">
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>

          <IconButton onClick={(e) => setAccountAnchor(e.currentTarget)} size="small">
            <Avatar sx={{ width: 28, height: 28, fontSize: 13 }}>NK</Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      <Menu anchorEl={newMenuAnchor} open={!!newMenuAnchor} onClose={() => setNewMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setNewMenuAnchor(null);
            setNewWorldOpen(true);
          }}
        >
          New world
        </MenuItem>
        {worldId && (
          <MenuItem
            onClick={() => {
              setNewMenuAnchor(null);
              setNewCampaignOpen(true);
            }}
          >
            New campaign
          </MenuItem>
        )}
        {worldId && campaignId && <Divider />}
        {worldId && campaignId && (
          <MenuItem onClick={() => goCreate(`/w/${worldId}/c/${campaignId}/notes?tab=quests`)}>New quest</MenuItem>
        )}
        {worldId && campaignId && (
          <MenuItem onClick={() => goCreate(`/w/${worldId}/c/${campaignId}/encounters`)}>New encounter</MenuItem>
        )}
        {worldId && campaignId && <MenuItem onClick={() => goCreate(`/w/${worldId}/c/${campaignId}/maps`)}>New map</MenuItem>}
        {worldId && (
          <MenuItem onClick={() => goCreate(`/w/${worldId}/manager?folder=places-bastions`)}>New bastion</MenuItem>
        )}
        {worldId && <MenuItem onClick={() => goCreate(`/w/${worldId}/manager`)}>New NPC / faction</MenuItem>}
      </Menu>

      <Menu anchorEl={runMenuAnchor} open={!!runMenuAnchor} onClose={() => setRunMenuAnchor(null)}>
        <MenuItem
          disabled={!worldId || !campaignId}
          onClick={() => {
            setRunMenuAnchor(null);
            if (worldId && campaignId) navigate(`/w/${worldId}/c/${campaignId}/play`);
          }}
        >
          <SportsEsportsIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
          Play page
        </MenuItem>
        <MenuItem
          disabled={!lastVisitedMap && !(worldId && campaignId)}
          onClick={() => {
            setRunMenuAnchor(null);
            if (lastVisitedMap) {
              navigate(`/w/${lastVisitedMap.worldId}/c/${lastVisitedMap.campaignId}/maps/${lastVisitedMap.mapId}`);
            } else if (worldId && campaignId) {
              navigate(`/w/${worldId}/c/${campaignId}/maps`);
            }
          }}
        >
          <MapIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
          Maps page
        </MenuItem>
      </Menu>

      <Menu anchorEl={accountAnchor} open={!!accountAnchor} onClose={() => setAccountAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAccountAnchor(null);
            if (worldId) navigate(campaignId ? `/w/${worldId}/c/${campaignId}/settings` : `/w/${worldId}/settings`);
          }}
          disabled={!worldId}
        >
          Settings
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAccountAnchor(null);
            startTutorial();
          }}
        >
          <HelpOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          Take the tour
        </MenuItem>
      </Menu>

      <NameDescriptionDialog
        open={newWorldOpen}
        title="New world"
        imageUpload
        onClose={() => setNewWorldOpen(false)}
        onSubmit={async (name, description, imageAssetId) => {
          const world = await addWorld(name, description, imageAssetId);
          setNewWorldOpen(false);
          navigate(`/w/${world.id}/home`);
        }}
      />
      <NameDescriptionDialog
        open={newCampaignOpen}
        title="New campaign"
        onClose={() => setNewCampaignOpen(false)}
        onSubmit={async (name, description) => {
          if (!worldId) return;
          const campaign = await addCampaign(worldId, name, description);
          setNewCampaignOpen(false);
          navigate(`/w/${worldId}/c/${campaign.id}/home`);
        }}
      />
    </>
  );
}
