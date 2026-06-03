import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Dices,
  ShieldCheck,
  PhoneOff,
  Mail,
  Sparkles,
  Radio,
  Shield,
  Radar,
  Wrench,
  Ban,
  BookOpen,
  Star,
  Flag,
  Activity,
  Scale,
  Clock,
  BarChart3,
  Bot,
} from 'lucide-react';
import { api } from '../api';
import type { Stats, Casino } from '../types';
import FeatureStrip from '../components/FeatureStrip';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import CasinoCarousel from '../components/CasinoCarousel';
import CarouselSkeleton from '../components/CarouselSkeleton';
import StatsSkeleton from '../components/StatsSkeleton';
import { useAuth } from '../context/AuthContext';
import ActivityFeed from '../components/ActivityFeed';
import RecentlyViewed from '../components/RecentlyViewed';
import { usePageTitle } from '../hooks/usePageTitle';
import ErrorBanner from '../components/ErrorBanner';

export default function DashboardPage() {
  usePageTitle('Dashboard — The Method Casinos');
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [featured, setFeatured] = useState<Casino[]>([]);
  const [recent, setRecent] = useState<Casino[]>([]);
  const [carouselsLoading, setCarouselsLoading] = useState(true);
  const [carouselError, setCarouselError] = useState(false);

  const loadStats = () => {
    setStatsLoading(true);
    setStatsError(false);
    api.getStats()
      .then(setStats)
      .catch(() => setStatsError(true))
      .finally(() => setStatsLoading(false));
  };

  const loadCarousels = () => {
    setCarouselsLoading(true);
    setCarouselError(false);
    Promise.all([
      api.getFeaturedCasinos(8),
      api.getRecentCasinos(8),
    ])
      .then(([f, r]) => {
        setFeatured(f);
        setRecent(r);
      })
      .catch(() => setCarouselError(true))
      .finally(() => setCarouselsLoading(false));
  };

  useEffect(() => {
    loadStats();
    loadCarousels();
  }, []);

  const greeting = user ? `Welcome, ${user.username}` : 'The Method Casinos';

  return (
    <div className="page-container">
      <PageHeader
        title={greeting}
        subtitle="Verified US sweepstakes casinos — browse, compare, check URLs, and find similar sites"
      />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <FeatureStrip compact />
      </motion.div>

      <RecentlyViewed />

      {user?.isAdmin && stats && (stats.pendingReview > 0 || (stats.openReports ?? 0) > 0 || (stats.failedHealthCasinos ?? 0) > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-amber-200">
            <Flag className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {stats.pendingReview > 0 && (
              <span>{stats.pendingReview} casino{stats.pendingReview === 1 ? '' : 's'} awaiting review</span>
            )}
            {stats.pendingReview > 0 && (stats.openReports ?? 0) > 0 && ' · '}
            {(stats.openReports ?? 0) > 0 && (
              <span>{stats.openReports} ban review item{(stats.openReports ?? 0) === 1 ? '' : 's'}</span>
            )}
            {((stats.pendingReview > 0 || (stats.openReports ?? 0) > 0) && (stats.failedHealthCasinos ?? 0) > 0) && ' · '}
            {(stats.failedHealthCasinos ?? 0) > 0 && (
              <span>{stats.failedHealthCasinos} failed health check{(stats.failedHealthCasinos ?? 0) === 1 ? '' : 's'}</span>
            )}
          </p>
          <div className="flex gap-3 text-sm">
            {stats.pendingReview > 0 && (
              <Link to="/review?tab=discoveries" className="text-glow hover:underline font-medium">Discoveries →</Link>
            )}
            {(stats.openReports ?? 0) > 0 && (
              <Link to="/review?tab=reports" className="text-glow hover:underline font-medium">Ban review →</Link>
            )}
          </div>
        </motion.div>
      )}

      {!statsLoading && statsError && (
        <ErrorBanner
          message="Could not load live stats — catalog and tools are still available."
          onRetry={loadStats}
          variant="warning"
        />
      )}

      {!statsLoading && stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-8 animate-stagger">
          <StatCard label="Verified Catalog" value={stats.verifiedCasinos} icon={ShieldCheck} color="bg-emerald-500/20 text-emerald-300" delay={0} />
          {user?.isAdmin && (
            <StatCard label="Pending Review" value={stats.pendingReview} icon={Clock} color="bg-amber-500/20 text-amber-300" delay={0.05} />
          )}
          <StatCard label="No Phone Required" value={stats.noPhoneCasinos} icon={PhoneOff} color="bg-glow/20 text-glow" delay={0.1} />
          <StatCard label="Email Only Signup" value={stats.emailOnlyCasinos} icon={Mail} color="bg-violet-500/20 text-violet-300" delay={0.15} />
          <StatCard label="With Slots" value={stats.withSlots} icon={Sparkles} color="bg-amber-500/20 text-amber-300" delay={0.2} />
          <StatCard label="Live Games" value={stats.withLiveGames} icon={Radio} color="bg-rose-500/20 text-rose-300" delay={0.25} />
          <StatCard label="VPN Allowed" value={stats.vpnAllowedCasinos} icon={Shield} color="bg-emerald-500/20 text-emerald-300" delay={0.3} />
          <StatCard label="Blocked Scams" value={stats.blockedSites} icon={Ban} color="bg-red-500/20 text-red-400" delay={0.35} />
        </div>
      ) : statsLoading ? (
        <StatsSkeleton count={user?.isAdmin ? 8 : 7} />
      ) : null}

      {carouselError && (
        <ErrorBanner
          message="Could not load featured carousels."
          onRetry={loadCarousels}
          variant="warning"
        />
      )}

      {carouselsLoading ? (
        <>
          <CarouselSkeleton title="Featured" />
          <CarouselSkeleton title="Recently Added" />
        </>
      ) : (
        <>
          <CasinoCarousel
            title="Featured"
            subtitle="Top-rated verified operators"
            casinos={featured}
            icon={<Star className="w-5 h-5 text-brand-light" />}
            action={<Link to="/casinos" className="text-sm text-glow hover:underline">View all</Link>}
          />

          <CasinoCarousel
            title="Recently Added"
            subtitle="Newest catalog entries"
            casinos={recent}
            icon={<Clock className="w-5 h-5 text-glow" />}
            action={<Link to="/new" className="text-sm text-glow hover:underline">All new arrivals</Link>}
          />

          <ActivityFeed />
        </>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-glow p-6 md:p-8"
      >
        <h2 className="font-display font-semibold text-lg mb-5 text-white">Quick Start</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 animate-stagger">
          {[
            { title: 'New Arrivals', desc: 'Recently approved operators added to the catalog.', path: '/new', icon: Clock },
            { title: 'Random Casino', desc: 'Roll a verified operator with optional filters — like /random.', path: '/random', icon: Dices },
            { title: 'Similar Casinos', desc: 'Match by features — or search the web for alike sites.', path: '/similar', icon: Sparkles },
            { title: 'Compare Casinos', desc: 'Side-by-side feature and signup comparison.', path: '/compare', icon: Scale },
            { title: 'Service Status', desc: 'Bot online, search engines, catalog stats.', path: '/status', icon: Activity },
            { title: 'Browse Casinos', desc: 'Verified catalog — filter by VPN, slots, email-only.', path: '/casinos', icon: Dices },
            { title: 'URL Safety Checker', desc: 'Check if a link is safe before visiting.', path: '/tools/checker', icon: ShieldCheck },
            { title: 'The Method Guides', desc: 'Step-by-step signup & safety workflows.', path: '/guides', icon: BookOpen },
            { title: 'Catalog Help', desc: 'Ask questions about filters, signup, and workflows.', path: '/assistant', icon: Bot },
            { title: 'Blocked Sites', desc: 'Scam, phishing, and dangerous URLs.', path: '/blocked', icon: Ban },
            { title: 'Tools Hub', desc: 'Temp mail, SMS, passwords, and more.', path: '/tools', icon: Wrench },
            { title: 'Discovery Scan', desc: user?.isAdmin ? 'Client-driven scan from your browser.' : 'Admin sign-in required.', path: user?.isAdmin ? '/discovery' : '/login?next=/discovery', icon: Radar },
            { title: 'Review Queue', desc: user?.isAdmin ? 'Approve discoveries & ban review.' : 'Admin sign-in required.', path: user?.isAdmin ? '/review' : '/login?next=/review', icon: Flag },
            ...(user?.isAdmin
              ? [{ title: 'Admin Insights', desc: 'Backlog, discovery stats, export pending CSV.', path: '/insights', icon: BarChart3 }]
              : []),
          ].map((item) => (
            <div key={item.title}>
              <Link
                to={item.path}
                className="block p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-glow/30 hover:bg-glow/5 transition-all h-full group card-shine"
              >
                <item.icon className="w-5 h-5 text-brand-light mb-2 group-hover:text-glow transition-colors" />
                <h3 className="font-medium mb-1 text-white">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </Link>
            </div>
          ))}
        </div>

        {stats?.lastDiscoveryAt && (
          <p className="text-sm text-gray-500 mt-6 pt-4 border-t border-white/10">
            Last discovery scan: {new Date(stats.lastDiscoveryAt).toLocaleString()}
          </p>
        )}
      </motion.div>
    </div>
  );
}
