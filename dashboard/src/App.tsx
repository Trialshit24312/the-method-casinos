import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';
import PageLoadingFallback from './components/PageLoadingFallback';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Casinos = lazy(() => import('./pages/Casinos'));
const Discovery = lazy(() => import('./pages/Discovery'));
const ReviewQueue = lazy(() => import('./pages/ReviewQueue'));
const SimilarCasinos = lazy(() => import('./pages/SimilarCasinos'));
const ToolsHub = lazy(() => import('./pages/tools/ToolsHub'));
const EmailGenerator = lazy(() => import('./pages/tools/EmailGenerator'));
const PhoneGenerator = lazy(() => import('./pages/tools/PhoneGenerator'));
const Rules = lazy(() => import('./pages/Rules'));
const Terms = lazy(() => import('./pages/Terms'));
const Guides = lazy(() => import('./pages/Guides'));
const PasswordGenerator = lazy(() => import('./pages/tools/PasswordGenerator'));
const UrlChecker = lazy(() => import('./pages/tools/UrlChecker'));
const BlockedSites = lazy(() => import('./pages/BlockedSites'));
const Privacy = lazy(() => import('./pages/Privacy'));
const CasinoDetail = lazy(() => import('./pages/CasinoDetail'));
const MyList = lazy(() => import('./pages/MyList'));
const LegalHub = lazy(() => import('./pages/LegalHub'));
const Compare = lazy(() => import('./pages/Compare'));
const RandomPick = lazy(() => import('./pages/RandomPick'));
const Status = lazy(() => import('./pages/Status'));
const Pricing = lazy(() => import('./pages/Pricing'));
const NewArrivals = lazy(() => import('./pages/NewArrivals'));
const AdminInsights = lazy(() => import('./pages/AdminInsights'));
const CatalogHelp = lazy(() => import('./pages/CatalogHelp'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteFallback() {
  return <PageLoadingFallback />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <PageLoadingFallback />;
  }
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!user.isAdmin) {
    return (
      <div className="page-container-narrow min-h-[60vh] flex flex-col justify-center">
        <div className="glass-glow p-8 text-center border-amber-500/30 border-gradient">
          <h1 className="font-display text-xl font-bold text-white mb-2">Admin access required</h1>
          <p className="text-gray-400 text-sm mb-4">
            You&apos;re signed in as <span className="text-white">{user.username}</span>, but this page is for catalog admins only.
            Ask the server owner to add your Discord ID to <code className="text-glow">ADMIN_DISCORD_IDS</code> on Render.
          </p>
          <Link to="/dashboard" className="btn-primary inline-block text-sm">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<RouteFallback />}>
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
            <Route path="/new" element={<NewArrivals />} />
            <Route path="/casinos/:slug" element={<CasinoDetail />} />
            <Route path="/mylist" element={<MyList />} />
            <Route path="/similar" element={<SimilarCasinos />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/random" element={<RandomPick />} />
            <Route path="/status" element={<Status />} />
            <Route path="/assistant" element={<CatalogHelp />} />
            <Route path="/blocked" element={<BlockedSites />} />
            <Route path="/guides" element={<Guides />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/tools" element={<ToolsHub />} />
            <Route path="/tools/email" element={<EmailGenerator />} />
            <Route path="/tools/phone" element={<PhoneGenerator />} />
            <Route path="/tools/password" element={<PasswordGenerator />} />
            <Route path="/tools/checker" element={<UrlChecker />} />
            <Route path="/legal" element={<LegalHub />} />
            <Route path="/discovery" element={<AdminRoute><Discovery /></AdminRoute>} />
            <Route path="/review" element={<AdminRoute><ReviewQueue /></AdminRoute>} />
            <Route path="/insights" element={<AdminRoute><AdminInsights /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
