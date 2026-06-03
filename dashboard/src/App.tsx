import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Casinos from './pages/Casinos';
import Discovery from './pages/Discovery';
import ReviewQueue from './pages/ReviewQueue';
import SimilarCasinos from './pages/SimilarCasinos';
import ToolsHub from './pages/tools/ToolsHub';
import EmailGenerator from './pages/tools/EmailGenerator';
import PhoneGenerator from './pages/tools/PhoneGenerator';
import Rules from './pages/Rules';
import Terms from './pages/Terms';
import Guides from './pages/Guides';
import PasswordGenerator from './pages/tools/PasswordGenerator';
import UrlChecker from './pages/tools/UrlChecker';
import BlockedSites from './pages/BlockedSites';
import Privacy from './pages/Privacy';
import CasinoDetail from './pages/CasinoDetail';
import MyList from './pages/MyList';
import LegalHub from './pages/LegalHub';
import PublicLayout from './components/PublicLayout';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-background">
        <div className="w-8 h-8 border-2 border-glow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user?.isAdmin) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route element={<PublicLayout />}>
          <Route path="/terms" element={<Terms />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/privacy" element={<Privacy />} />
        </Route>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/casinos" element={<Casinos />} />
          <Route path="/casinos/:slug" element={<CasinoDetail />} />
          <Route path="/mylist" element={<MyList />} />
          <Route path="/similar" element={<SimilarCasinos />} />
          <Route path="/assistant" element={<Navigate to="/similar" replace />} />
          <Route path="/blocked" element={<BlockedSites />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="/tools" element={<ToolsHub />} />
          <Route path="/tools/email" element={<EmailGenerator />} />
          <Route path="/tools/phone" element={<PhoneGenerator />} />
          <Route path="/tools/password" element={<PasswordGenerator />} />
          <Route path="/tools/checker" element={<UrlChecker />} />
          <Route path="/legal" element={<LegalHub />} />
          <Route path="/discovery" element={<AdminRoute><Discovery /></AdminRoute>} />
          <Route path="/review" element={<AdminRoute><ReviewQueue /></AdminRoute>} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
