import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { Dashboard } from "./pages/Dashboard";
import { LaunchAd } from "./pages/LaunchAd";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="launch" element={<LaunchAd />} />
          <Route path="campaigns" element={<div className="p-4">Campaigns Page (Coming Soon)</div>} />
          <Route path="settings" element={<div className="p-4">Settings Page (Coming Soon)</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
