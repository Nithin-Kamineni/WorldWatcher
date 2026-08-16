import { Navigate, Route, Routes } from 'react-router-dom';
import { CampaignsPage } from '../pages/CampaignsPage';
import { RoleSelectionPage } from '../pages/RoleSelectionPage';
import { DMPanelPage } from '../pages/DMPanelPage';
import { MapPage } from '../pages/MapPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/campaigns" replace />} />
      <Route path="/campaigns" element={<CampaignsPage />} />
      <Route path="/campaigns/:campaignId" element={<RoleSelectionPage />} />
      <Route path="/campaigns/:campaignId/dm" element={<DMPanelPage />} />
      <Route path="/campaigns/:campaignId/dm/map/:mapId" element={<MapPage />} />
      <Route path="*" element={<Navigate to="/campaigns" replace />} />
    </Routes>
  );
}
