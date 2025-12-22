import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FacebookProvider } from "./contexts/FacebookContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { LaunchAd } from "./pages/LaunchAd";
import { Creatives } from "./pages/Creatives";
import { FBProfiles } from "./pages/FBProfiles";
import { FBAdAccounts } from "./pages/FBAdAccounts";
import { FBAdLibrary } from './pages/FBAdLibrary';
import { TeamSettings } from "./pages/TeamSettings";
import { AdCopyLibrary } from "./pages/AdCopyLibrary";
import { AdPlanning } from "./pages/AdPlanning";
import { Ads } from "./pages/Ads";
import { AdCombos } from "./pages/AdCombos";
import { PersonaAICopy } from "./pages/PersonaAICopy";
import { SavedPersonasLibrary } from "./pages/SavedPersonasLibrary";
import { CopyLibrary } from "./pages/CopyLibrary";
import { Login } from "./pages/Login";
import { UserSettings } from "./pages/UserSettings";
import { VideoGenerator } from "./pages/VideoGenerator";
import { AIVideoGenerated } from "./pages/AIVideoGenerated";
import { SoraCharacters } from "./pages/SoraCharacters";
import { Loader2 } from "lucide-react";

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Public route wrapper (redirect to home if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <FacebookProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />

            {/* Protected Routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdCopyLibrary />} />
              <Route path="launch" element={<LaunchAd />} />
              <Route path="creatives" element={<Creatives />} />

              <Route path="facebook/profiles" element={<FBProfiles />} />
              <Route path="facebook/ad-accounts" element={<FBAdAccounts />} />
              <Route path="fb-ad-library" element={<FBAdLibrary />} />
              {/* Redirect old ad-accounts path */}
              <Route path="ad-accounts" element={<Navigate to="/facebook/ad-accounts" replace />} />
              {/* Redirect old ad-copies path to home */}
              <Route path="ad-copies" element={<Navigate to="/" replace />} />
              <Route path="ad-planning" element={<AdPlanning />} />
              <Route path="ads" element={<Ads />} />
              <Route path="ads/create" element={<AdCombos />} />
              <Route path="video-generator" element={<VideoGenerator />} />
              <Route path="ai-video-generated" element={<AIVideoGenerated />} />
              <Route path="sora-characters" element={<SoraCharacters />} />
              <Route path="copy-wizard" element={<PersonaAICopy />} />
              <Route path="copy-library" element={<CopyLibrary />} />
              {/* Redirect old routes */}
              <Route path="ai-copywriting" element={<Navigate to="/copy-wizard" replace />} />
              <Route path="saved-personas" element={<Navigate to="/copy-library" replace />} />
              <Route path="admin" element={<TeamSettings />} />
              <Route path="settings" element={<UserSettings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </FacebookProvider>
    </AuthProvider>
  );
}

export default App;
