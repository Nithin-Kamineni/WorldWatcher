import type { SvgIconComponent } from '@mui/icons-material';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import ScienceIcon from '@mui/icons-material/Science';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import FavoriteIcon from '@mui/icons-material/Favorite';
import HearingDisabledIcon from '@mui/icons-material/HearingDisabled';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import SentimentVeryDissatisfiedIcon from '@mui/icons-material/SentimentVeryDissatisfied';
import PanToolIcon from '@mui/icons-material/PanTool';
import BlockIcon from '@mui/icons-material/Block';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import LandscapeIcon from '@mui/icons-material/Landscape';
import AirlineSeatFlatIcon from '@mui/icons-material/AirlineSeatFlat';
import LinkIcon from '@mui/icons-material/Link';
import FlareIcon from '@mui/icons-material/Flare';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import HeartBrokenIcon from '@mui/icons-material/HeartBroken';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import DoNotDisturbOnIcon from '@mui/icons-material/DoNotDisturbOn';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FrontHandIcon from '@mui/icons-material/FrontHand';
import SpeedIcon from '@mui/icons-material/Speed';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import ShieldIcon from '@mui/icons-material/Shield';
import FilterNoneIcon from '@mui/icons-material/FilterNone';
import AirIcon from '@mui/icons-material/Air';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import HubIcon from '@mui/icons-material/Hub';
import GrassIcon from '@mui/icons-material/Grass';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PetsIcon from '@mui/icons-material/Pets';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import CoronavirusIcon from '@mui/icons-material/Coronavirus';
import DiamondIcon from '@mui/icons-material/Diamond';

/**
 * A glanceable icon per token effect, so the initiative bar can say "poisoned, prone,
 * concentrating" without the DM opening the row. Effects are stored as plain names
 * (PlacedToken.effects - conditions from the compendium, curated spell markers, or anything
 * the DM typed), so this is keyed by lowercased name. Anything not listed - a custom effect,
 * a disease the table added - gets a lettered badge instead of being dropped, because an
 * effect the DM cannot see is exactly the one they forget.
 */
interface EffectIcon {
  icon: SvgIconComponent;
  color: string;
}

const EFFECT_ICONS: Record<string, EffectIcon> = {
  // core conditions
  poisoned: { icon: ScienceIcon, color: '#7cb342' },
  blinded: { icon: VisibilityOffIcon, color: '#90a4ae' },
  charmed: { icon: FavoriteIcon, color: '#ec407a' },
  deafened: { icon: HearingDisabledIcon, color: '#90a4ae' },
  exhaustion: { icon: BatteryAlertIcon, color: '#ff8f00' },
  frightened: { icon: SentimentVeryDissatisfiedIcon, color: '#ab47bc' },
  grappled: { icon: PanToolIcon, color: '#8d6e63' },
  incapacitated: { icon: BlockIcon, color: '#e53935' },
  invisible: { icon: BlurOnIcon, color: '#b3e5fc' },
  paralyzed: { icon: AcUnitIcon, color: '#4fc3f7' },
  petrified: { icon: LandscapeIcon, color: '#9e9e9e' },
  prone: { icon: AirlineSeatFlatIcon, color: '#a1887f' },
  restrained: { icon: LinkIcon, color: '#8d6e63' },
  stunned: { icon: FlareIcon, color: '#fdd835' },
  unconscious: { icon: BedtimeIcon, color: '#5c6bc0' },
  // statuses
  bloodied: { icon: WaterDropIcon, color: '#e53935' },
  concentration: { icon: PsychologyIcon, color: '#1e88e5' },
  surprised: { icon: PriorityHighIcon, color: '#fdd835' },
  dying: { icon: HeartBrokenIcon, color: '#e53935' },
  stable: { icon: MonitorHeartIcon, color: '#43a047' },
  // spells & effects (types/effect.ts SPELL_STATUS_EFFECTS)
  bless: { icon: WbSunnyIcon, color: '#ffca28' },
  bane: { icon: DoNotDisturbOnIcon, color: '#8e24aa' },
  hex: { icon: GpsFixedIcon, color: '#8e24aa' },
  "hunter's mark": { icon: GpsFixedIcon, color: '#43a047' },
  'faerie fire': { icon: AutoAwesomeIcon, color: '#ce93d8' },
  'hold person': { icon: FrontHandIcon, color: '#4fc3f7' },
  confusion: { icon: QuestionMarkIcon, color: '#ab47bc' },
  haste: { icon: SpeedIcon, color: '#26c6da' },
  slow: { icon: HourglassBottomIcon, color: '#78909c' },
  sanctuary: { icon: ShieldIcon, color: '#fff59d' },
  'shield of faith': { icon: ShieldIcon, color: '#ffca28' },
  stoneskin: { icon: DiamondIcon, color: '#9e9e9e' },
  'mirror image': { icon: FilterNoneIcon, color: '#b3e5fc' },
  blur: { icon: BlurOnIcon, color: '#b3e5fc' },
  fly: { icon: AirIcon, color: '#81d4fa' },
  enlarge: { icon: ZoomOutMapIcon, color: '#ff7043' },
  reduce: { icon: ZoomInMapIcon, color: '#ff7043' },
  web: { icon: HubIcon, color: '#e0e0e0' },
  entangle: { icon: GrassIcon, color: '#66bb6a' },
  silence: { icon: VolumeOffIcon, color: '#90a4ae' },
  guidance: { icon: LightbulbIcon, color: '#ffee58' },
  'bardic inspiration': { icon: MusicNoteIcon, color: '#f06292' },
  polymorph: { icon: PetsIcon, color: '#8d6e63' },
  banishment: { icon: ExitToAppIcon, color: '#7e57c2' },
  'dominate person': { icon: SettingsRemoteIcon, color: '#8e24aa' },
  rage: { icon: WhatshotIcon, color: '#ff5722' },
  dodge: { icon: DirectionsRunIcon, color: '#26a69a' },
};

/** Anything disease-like that the table added without a listed icon still reads as one. */
const DISEASE_ICON: EffectIcon = { icon: CoronavirusIcon, color: '#9ccc65' };

function iconFor(name: string): EffectIcon | null {
  const key = name.trim().toLowerCase();
  const direct = EFFECT_ICONS[key];
  if (direct) return direct;
  // "Exhaustion 2", "Poisoned (1 min)" and the like still match their base condition.
  for (const [base, icon] of Object.entries(EFFECT_ICONS)) {
    if (key.startsWith(`${base} `) || key.startsWith(`${base}(`)) return icon;
  }
  if (/(fever|plague|rot|pox|disease|sickness|blight)/.test(key)) return DISEASE_ICON;
  return null;
}

/** One effect as a small round badge: its icon, or its first letter when it has none. */
export function EffectBadge({ name, size }: { name: string; size: number }) {
  const match = iconFor(name);
  const Icon = match?.icon;
  return (
    <Tooltip title={name}>
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          bgcolor: 'rgba(15,15,20,0.85)',
          border: '1px solid rgba(255,255,255,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: match?.color ?? '#ffffff',
          fontSize: size * 0.55,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {Icon ? <Icon sx={{ fontSize: size * 0.72 }} /> : name.trim().charAt(0).toUpperCase() || '?'}
      </Box>
    </Tooltip>
  );
}
