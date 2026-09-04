import Box from '@mui/material/Box';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BedtimeOutlinedIcon from '@mui/icons-material/BedtimeOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import DiamondOutlinedIcon from '@mui/icons-material/DiamondOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import ForestOutlinedIcon from '@mui/icons-material/ForestOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import LocalBarOutlinedIcon from '@mui/icons-material/LocalBarOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import TheaterComedyOutlinedIcon from '@mui/icons-material/TheaterComedyOutlined';
import ThunderstormOutlinedIcon from '@mui/icons-material/ThunderstormOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

/** Shared resolver so graph nodes and the category drawer always use the same artwork. */
export function categoryIconFor(name: string, icon?: string | null) {
  if (icon && /^(https?:|data:|\/)/i.test(icon)) {
    return <Box component="img" src={icon} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
  }
  const explicit = icon?.toLowerCase() ?? '';
  const value = name.toLowerCase();
  if (explicit.includes('weather') || value.includes('weather')) return <ThunderstormOutlinedIcon />;
  if (explicit.includes('tavern') || value.includes('tavern')) return <LocalBarOutlinedIcon />;
  if (value.includes('name')) return <BadgeOutlinedIcon />;
  if (value.includes('dream') || value.includes('vision') || value.includes('omen')) return <BedtimeOutlinedIcon />;
  if (value.includes('rumor') || value.includes('gossip') || value.includes('conversation')) return <RecordVoiceOverOutlinedIcon />;
  if (value.includes('coin') || value.includes('currency')) return <PaidOutlinedIcon />;
  if (value.includes('poison') || value.includes('disease')) return <ScienceOutlinedIcon />;
  if (value.includes('dungeon') || value.includes('bastion')) return <AccountBalanceOutlinedIcon />;
  if (value.includes('downtime') || value.includes('calendar') || value.includes('season') || value.includes('life event')) return <EventOutlinedIcon />;
  if (value.includes('flavor') || value.includes('roleplay') || value.includes('scene')) return <TheaterComedyOutlinedIcon />;
  if (value.includes('encounter') || value.includes('combat')) return <ShieldOutlinedIcon />;
  if (value.includes('npc') || value.includes('creature')) return <GroupsOutlinedIcon />;
  if (value.includes('location') || value.includes('settlement') || value.includes('building')) return <HomeWorkOutlinedIcon />;
  if (value.includes('environment') || value.includes('travel') || value.includes('wilderness')) return <ForestOutlinedIcon />;
  if (value.includes('hazard') || value.includes('trap') || value.includes('affliction')) return <WarningAmberOutlinedIcon />;
  if (value.includes('treasure') || value.includes('reward') || value.includes('item')) return <DiamondOutlinedIcon />;
  if (value.includes('adventure') || value.includes('plot')) return <MapOutlinedIcon />;
  if (value.includes('custom') || value.includes('homebrew')) return <AutoAwesomeIcon />;
  return <CategoryOutlinedIcon />;
}
