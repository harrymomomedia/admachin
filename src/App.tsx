import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FacebookProvider } from "./contexts/FacebookContext";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { Dashboard } from "./pages/Dashboard";
import { LaunchAd } from "./pages/LaunchAd";
import { Creatives } from "./pages/Creatives";
import { AdAccounts } from "./pages/AdAccounts";
import { TeamSettings } from "./pages/TeamSettings";
import { AccessGate } from "./components/AccessGate";

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
              <Route path="ad-accounts" element={<AdAccounts />} />
              <Route path="team-settings" element={<TeamSettings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AccessGate>
    </FacebookProvider>
  );
}

export default App;
