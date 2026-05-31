import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Casinos from './pages/Casinos';
import Discovery from './pages/Discovery';
import ToolsHub from './pages/tools/ToolsHub';
import EmailGenerator from './pages/tools/EmailGenerator';
import PhoneGenerator from './pages/tools/PhoneGenerator';
import Rules from './pages/Rules';
import Terms from './pages/Terms';
import Guides from './pages/Guides';
import PasswordGenerator from './pages/tools/PasswordGenerator';
import UrlChecker from './pages/tools/UrlChecker';
import BlockedSites from './pages/BlockedSites';
import SimilarCasinos from './pages/SimilarCasinos';
import Privacy from './pages/Privacy';
import PublicLayout from './components/PublicLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center app-background">
        <img src="/logo.png" alt="" className="w-16 h-16 mb-4 opacity-80 animate-pulse" />
        <div className="w-8 h-8 border-2 border-glow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<PublicLayout />}>
          <Route path="/terms" element={<Terms />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/privacy" element={<Privacy />} />
        </Route>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="casinos" element={<Casinos />} />
          <Route path="similar" element={<SimilarCasinos />} />
          <Route path="discovery" element={<Discovery />} />
          <Route path="blocked" element={<BlockedSites />} />
          <Route path="guides" element={<Guides />} />
          <Route path="tools" element={<ToolsHub />} />
          <Route path="tools/email" element={<EmailGenerator />} />
          <Route path="tools/phone" element={<PhoneGenerator />} />
          <Route path="tools/password" element={<PasswordGenerator />} />
          <Route path="tools/checker" element={<UrlChecker />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
