import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FacebookProvider } from "./contexts/FacebookContext";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { Dashboard } from "./pages/Dashboard";
import { LaunchAd } from "./pages/LaunchAd";
import { Creatives } from "./pages/Creatives";
import { FBProfiles } from "./pages/FBProfiles";
import { FBAdAccounts } from "./pages/FBAdAccounts";
import { FBAdLibrary } from './pages/FBAdLibrary';
import { TeamSettings } from "./pages/TeamSettings";
import { AccessGate } from "./components/AccessGate";
import { AdCopyLibrary } from "./pages/AdCopyLibrary";
import { AdPlanning } from "./pages/AdPlanning";
import { AICopywriting } from "./pages/AICopywriting";

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

              <Route path="facebook/profiles" element={<FBProfiles />} />
              <Route path="facebook/ad-accounts" element={<FBAdAccounts />} />
              <Route path="fb-ad-library" element={<FBAdLibrary />} />
              {/* Redirect old ad-accounts path */}
              <Route path="ad-accounts" element={<Navigate to="/facebook/ad-accounts" replace />} />
              <Route path="ad-copies" element={<AdCopyLibrary />} />
              <Route path="ad-planning" element={<AdPlanning />} />
              <Route path="ai-copywriting" element={<AICopywriting />} />
              <Route path="admin" element={<TeamSettings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AccessGate>
    </FacebookProvider>
  );
}

export default App;

