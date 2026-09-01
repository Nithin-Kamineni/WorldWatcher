import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { DashboardPage } from '../pages/DashboardPage';
import { WorldHomePage } from '../pages/world/WorldHomePage';
import { WorldManagerPage } from '../pages/world/WorldManagerPage';
import { ArticleDetailPage } from '../pages/world/ArticleDetailPage';
import { AtlasPage } from '../pages/world/AtlasPage';
import { TimelinePage } from '../pages/world/TimelinePage';
import { CompendiumPage } from '../pages/world/CompendiumPage';
import { ToolsPage } from '../pages/world/ToolsPage';
import { WorldSettingsPage } from '../pages/world/WorldSettingsPage';
import { PlayPage } from '../pages/campaign/PlayPage';
import { NotesPage } from '../pages/campaign/NotesPage';
import { NoteDetailPage } from '../pages/campaign/NoteDetailPage';
import { EncountersPage } from '../pages/campaign/EncountersPage';
import { MapsPage } from '../pages/campaign/MapsPage';
import { CampaignSettingsPage } from '../pages/campaign/CampaignSettingsPage';
import { MapPage } from '../pages/MapPage';
import { LegacyCampaignRedirect } from '../components/shell/LegacyRedirect';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />

      <Route path="/w/:worldId" element={<WorldHomeRedirect />} />
      <Route path="/w/:worldId/home" element={<WorldHomePage />} />
      <Route path="/w/:worldId/manager" element={<WorldManagerPage />} />
      <Route path="/w/:worldId/manager/entry/new" element={<ArticleDetailPage />} />
      <Route path="/w/:worldId/manager/entry/:entryId" element={<ArticleDetailPage />} />
      <Route path="/w/:worldId/atlas" element={<AtlasPage />} />
      <Route path="/w/:worldId/timeline" element={<TimelinePage />} />
      <Route path="/w/:worldId/compendium" element={<CompendiumPage />} />
      <Route path="/w/:worldId/tools" element={<ToolsPage />} />
      <Route path="/w/:worldId/settings" element={<WorldSettingsPage />} />

      {/* Campaign Home was retired as a hub page (Plots/Quests/Encounters/Maps/Party moved to
          World Home's Resume card + the icon rail's campaign group) - both the bare campaign
          URL and its old /home path now redirect straight to World Home so old links/
          bookmarks don't 404. */}
      <Route path="/w/:worldId/c/:campaignId" element={<CampaignHomeRedirect />} />
      <Route path="/w/:worldId/c/:campaignId/home" element={<CampaignHomeRedirect />} />
      <Route path="/w/:worldId/c/:campaignId/play" element={<PlayPage />} />
      <Route path="/w/:worldId/c/:campaignId/notes" element={<NotesPage />} />
      <Route path="/w/:worldId/c/:campaignId/notes/new" element={<NoteDetailPage />} />
      <Route path="/w/:worldId/c/:campaignId/notes/:noteId" element={<NoteDetailPage />} />
      <Route path="/w/:worldId/c/:campaignId/encounters" element={<EncountersPage />} />
      <Route path="/w/:worldId/c/:campaignId/maps" element={<MapsPage />} />
      <Route path="/w/:worldId/c/:campaignId/maps/:mapId" element={<MapPage />} />
      <Route path="/w/:worldId/c/:campaignId/settings" element={<CampaignSettingsPage />} />

      {/* Old rail destinations, relocated - redirect so bookmarks/palette history don't 404.
          Plots and Quests now live as toggles inside Notes; Party's Characters moved into
          World Manager's People group and Bastions into its Places group. */}
      <Route path="/w/:worldId/c/:campaignId/plots" element={<NotesTabRedirect tab="plots" />} />
      <Route path="/w/:worldId/c/:campaignId/quests" element={<NotesTabRedirect tab="quests" />} />
      <Route path="/w/:worldId/c/:campaignId/party" element={<PartyRedirect />} />

      {/* Legacy campaign-first URLs redirect into the new World -> Campaign shell */}
      <Route path="/campaigns" element={<Navigate to="/dashboard" replace />} />
      <Route path="/campaigns/:campaignId" element={<LegacyCampaignRedirect suffix={() => '/home'} />} />
      <Route path="/campaigns/:campaignId/dm" element={<LegacyCampaignRedirect suffix={() => '/home'} />} />
      <Route
        path="/campaigns/:campaignId/dm/map/:mapId"
        element={<LegacyCampaignRedirect suffix={(mapId) => `/maps/${mapId}`} />}
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function WorldHomeRedirect() {
  const { worldId } = useParams<{ worldId: string }>();
  return <Navigate to={`/w/${worldId}/home`} replace />;
}

function CampaignHomeRedirect() {
  const { worldId } = useParams<{ worldId: string }>();
  return <Navigate to={`/w/${worldId}/home`} replace />;
}

function NotesTabRedirect({ tab }: { tab: 'plots' | 'quests' }) {
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>();
  return <Navigate to={`/w/${worldId}/c/${campaignId}/notes?tab=${tab}`} replace />;
}

function PartyRedirect() {
  const { worldId } = useParams<{ worldId: string }>();
  return <Navigate to={`/w/${worldId}/manager?folder=places-bastions`} replace />;
}
