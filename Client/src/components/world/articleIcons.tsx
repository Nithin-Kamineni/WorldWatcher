import type { ReactNode } from 'react';
import PersonIcon from '@mui/icons-material/Person';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import TerrainIcon from '@mui/icons-material/Terrain';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import PublicIcon from '@mui/icons-material/Public';
import GroupsIcon from '@mui/icons-material/Groups';
import DiamondIcon from '@mui/icons-material/Diamond';
import RouteIcon from '@mui/icons-material/Route';
import EventIcon from '@mui/icons-material/Event';
import CastleIcon from '@mui/icons-material/Castle';
import DescriptionIcon from '@mui/icons-material/Description';

const ICON_MAP: Record<string, ReactNode> = {
  Person: <PersonIcon />,
  AutoAwesome: <AutoAwesomeIcon />,
  LocationCity: <LocationCityIcon />,
  Terrain: <TerrainIcon />,
  HomeWork: <HomeWorkIcon />,
  Public: <PublicIcon />,
  Groups: <GroupsIcon />,
  Diamond: <DiamondIcon />,
  Route: <RouteIcon />,
  Event: <EventIcon />,
  Castle: <CastleIcon />,
};

/** Resolves an ArticleTemplate's plain-string `icon` key (types/article.ts is kept JSX-free)
 * to an actual MUI icon element. Falls back to a generic document icon for unknown keys. */
export function getArticleCategoryIcon(iconKey: string): ReactNode {
  return ICON_MAP[iconKey] ?? <DescriptionIcon />;
}
