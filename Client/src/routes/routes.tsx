import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { LegacyCampaignRedirect } from '../components/shell/LegacyRedirect';

/** Every page is a dynamic import, so a route only downloads what it needs.
 *
 * The client used to ship as one 2.27 MB chunk: opening Play pulled the Konva map canvas, the
 * TipTap editors and the whole compendium UI down with it, and every one of those is only
 * reachable from a route (checklist I-U3). Each page here is its own chunk, and the libraries
 * that only one page uses land in that page's chunk - so a session-time page loads a fraction
 * of what it used to.
 *
 * They export named components rather than defaults, hence the `.then` mapping; keeping the
 * named exports means nothing outside this file changes. */
const DashboardPage = lazy(() => import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const WorldHomePage = lazy(() => import('../pages/world/WorldHomePage').then((m) => ({ default: m.WorldHomePage })));
const WorldManagerPage = lazy(() => import('../pages/world/WorldManagerPage').then((m) => ({ default: m.WorldManagerPage })));
const ArticleDetailPage = lazy(() => import('../pages/world/ArticleDetailPage').then((m) => ({ default: m.ArticleDetailPage })));
const AtlasPage = lazy(() => import('../pages/world/AtlasPage').then((m) => ({ default: m.AtlasPage })));
const TimelinePage = lazy(() => import('../pages/world/TimelinePage').then((m) => ({ default: m.TimelinePage })));
const CompendiumPage = lazy(() => import('../pages/world/CompendiumPage').then((m) => ({ default: m.CompendiumPage })));
const ToolsPage = lazy(() => import('../pages/world/ToolsPage').then((m) => ({ default: m.ToolsPage })));
const WorldSettingsPage = lazy(() => import('../pages/world/WorldSettingsPage').then((m) => ({ default: m.WorldSettingsPage })));
const PlayPage = lazy(() => import('../pages/campaign/PlayPage').then((m) => ({ default: m.PlayPage })));
const NotesPage = lazy(() => import('../pages/campaign/NotesPage').then((m) => ({ default: m.NotesPage })));
const NoteDetailPage = lazy(() => import('../pages/campaign/NoteDetailPage').then((m) => ({ default: m.NoteDetailPage })));
const ChatDetailPage = lazy(() => import('../pages/campaign/ChatDetailPage').then((m) => ({ default: m.ChatDetailPage })));
const EncountersPage = lazy(() => import('../pages/campaign/EncountersPage').then((m) => ({ default: m.EncountersPage })));
const TablesPage = lazy(() => import('../pages/campaign/TablesPage').then((m) => ({ default: m.TablesPage })));
const MapsPage = lazy(() => import('../pages/campaign/MapsPage').then((m) => ({ default: m.MapsPage })));
const CampaignSettingsPage = lazy(() => import('../pages/campaign/CampaignSettingsPage').then((m) => ({ default: m.CampaignSettingsPage })));
const MapPage = lazy(() => import('../pages/MapPage').then((m) => ({ default: m.MapPage })));

/** Shown while a route's chunk is in flight. A top-edge progress bar rather than a centred
 * spinner: the wait is normally a few hundred milliseconds on a cold route and nothing at all
 * on a warm one, and a full-screen spinner for that reads as a page that broke. */
function RouteFallback() {
  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: (theme) => theme.zIndex.appBar + 1 }}>
      <LinearProgress />
    </Box>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
        {/* One DM-notes thread as a document page - where "view"/"edit" on a chat now lands,
            instead of the Play page (see ChatDetailPage). */}
        <Route path="/w/:worldId/c/:campaignId/chats/:chatId" element={<ChatDetailPage />} />
        {/* Two destinations, two jobs (checklist R4): /tables is "roll me something" and
            /encounters is "the one I built". Each still forwards the other's old ?view= link
            shape, so nothing bookmarked before the split breaks. */}
        <Route path="/w/:worldId/c/:campaignId/tables" element={<TablesPage />} />
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
    </Suspense>
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
