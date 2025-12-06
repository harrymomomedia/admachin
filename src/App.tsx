import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FacebookProvider } from "./contexts/FacebookContext";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { Dashboard } from "./pages/Dashboard";
import { LaunchAd } from "./pages/LaunchAd";
import { Creatives } from "./pages/Creatives";
import { FBProfiles } from "./pages/FBProfiles";
import { FBAdAccounts } from "./pages/FBAdAccounts";
import { TeamSettings } from "./pages/TeamSettings";
import { AccessGate } from "./components/AccessGate";
import { AdCopyLibrary } from "./pages/AdCopyLibrary";

function App() {
  return (
    <FacebookProvider>
      <AccessGate>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="launch" element={<LaunchAd />} />
              <Route path="creatives" element={<Creatives />} />
              <Route path="campaigns" element={<div className="p-4">Campaigns Page (Coming Soon)</div>} />
              <Route path="facebook/profiles" element={<FBProfiles />} />
              <Route path="facebook/ad-accounts" element={<FBAdAccounts />} />
              {/* Redirect old ad-accounts path */}
              <Route path="ad-accounts" element={<Navigate to="/facebook/ad-accounts" replace />} />
              <Route path="ad-copies" element={<AdCopyLibrary />} />
              <Route path="team-settings" element={<TeamSettings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AccessGate>
    </FacebookProvider>
  );
}

export default App;

