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
  Clock,
  Flag,
  Activity,
  Scale,
} from 'lucide-react';
import { api } from '../api';
import type { Stats, Casino } from '../types';
import FeatureStrip from '../components/FeatureStrip';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import CasinoCard from '../components/CasinoCard';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [topCasinos, setTopCasinos] = useState<Casino[]>([]);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
    api.getCasinos().then((all) => setTopCasinos(all.slice(0, 6))).catch(console.error);
  }, []);

  const greeting = user ? `Welcome, ${user.username}` : 'The Method Casinos';

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title={greeting}
        subtitle="Verified US sweepstakes casinos — browse, compare, check URLs, and find similar sites"
      />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <FeatureStrip compact />
      </motion.div>

      {user?.isAdmin && stats && (stats.pendingReview > 0 || (stats.openReports ?? 0) > 0 || (stats.failedHealthCasinos ?? 0) > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-amber-200">
            <Flag className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {stats.pendingReview > 0 && (
              <span>{stats.pendingReview} casino{stats.pendingReview === 1 ? '' : 's'} awaiting review</span>
            )}
            {stats.pendingReview > 0 && (stats.openReports ?? 0) > 0 && ' · '}
            {(stats.openReports ?? 0) > 0 && (
              <span>{stats.openReports} open user report{(stats.openReports ?? 0) === 1 ? '' : 's'}</span>
            )}
            {((stats.pendingReview > 0 || (stats.openReports ?? 0) > 0) && (stats.failedHealthCasinos ?? 0) > 0) && ' · '}
            {(stats.failedHealthCasinos ?? 0) > 0 && (
              <span>{stats.failedHealthCasinos} failed health check{(stats.failedHealthCasinos ?? 0) === 1 ? '' : 's'}</span>
            )}
          </p>
          <Link to="/review" className="text-sm text-glow hover:underline font-medium">
            Open review queue →
          </Link>
        </motion.div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Verified Catalog" value={stats.verifiedCasinos} icon={ShieldCheck} color="bg-emerald-500/20 text-emerald-300" delay={0} />
          {user?.isAdmin && (
            <StatCard label="Pending Review" value={stats.pendingReview} icon={Clock} color="bg-amber-500/20 text-amber-300" delay={0.05} />
          )}
          {user?.isAdmin && (stats.staleCatalogCasinos ?? 0) > 0 && (
            <StatCard label="Stale Catalog (90d+)" value={stats.staleCatalogCasinos ?? 0} icon={Clock} color="bg-orange-500/20 text-orange-300" delay={0.06} />
          )}
          {user?.isAdmin && (stats.failedHealthCasinos ?? 0) > 0 && (
            <StatCard label="Failed Health" value={stats.failedHealthCasinos ?? 0} icon={Flag} color="bg-red-500/20 text-red-300" delay={0.065} />
          )}
          <StatCard label="No Phone Required" value={stats.noPhoneCasinos} icon={PhoneOff} color="bg-[#00aeef]/20 text-[#00aeef]" delay={0.1} />
          <StatCard label="Email Only Signup" value={stats.emailOnlyCasinos} icon={Mail} color="bg-violet-500/20 text-violet-300" delay={0.15} />
          <StatCard label="With Slots" value={stats.withSlots} icon={Sparkles} color="bg-amber-500/20 text-amber-300" delay={0.2} />
          <StatCard label="Live Games" value={stats.withLiveGames} icon={Radio} color="bg-rose-500/20 text-rose-300" delay={0.25} />
          <StatCard label="VPN Allowed" value={stats.vpnAllowedCasinos} icon={Shield} color="bg-emerald-500/20 text-emerald-300" delay={0.3} />
          <StatCard label="Blocked Scams" value={stats.blockedSites} icon={Ban} color="bg-red-500/20 text-red-400" delay={0.35} />
        </div>
      )}

      {topCasinos.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-[#d4956a]" /> Top Rated
            </h2>
            <Link to="/casinos" className="text-sm text-[#00aeef] hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {topCasinos.map((casino, i) => (
              <CasinoCard key={casino.id} casino={casino} index={i} />
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-glow p-6 border-[#00aeef]/15"
      >
        <h2 className="font-display font-semibold text-lg mb-4 text-white">Quick Start</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'Similar Casinos', desc: 'Match by features — or search the web for casinos like any operator.', path: '/similar', icon: Sparkles, accent: 'border-[#00aeef]/30 hover:border-[#00aeef]/60' },
            { title: 'Compare Casinos', desc: 'Side-by-side feature and signup comparison.', path: '/compare', icon: Scale, accent: 'border-brand/30 hover:border-brand/60' },
            { title: 'Service Status', desc: 'Bot online, search engines, catalog stats.', path: '/status', icon: Activity, accent: 'border-emerald-500/30 hover:border-emerald-500/60' },
            { title: 'Browse Casinos', desc: 'Verified catalog — filter by VPN, slots, email-only.', path: '/casinos', icon: Dices, accent: 'border-[#b87333]/30 hover:border-[#b87333]/60' },
            { title: 'URL Safety Checker', desc: 'Check if a link is safe before visiting.', path: '/tools/checker', icon: ShieldCheck, accent: 'border-emerald-500/30 hover:border-emerald-500/60' },
            { title: 'The Method Guides', desc: 'Step-by-step signup & safety workflows.', path: '/guides', icon: BookOpen, accent: 'border-[#b87333]/30 hover:border-[#b87333]/60' },
            { title: 'Blocked Sites', desc: 'Scam, phishing, and dangerous URLs.', path: '/blocked', icon: Ban, accent: 'border-red-500/30 hover:border-red-500/60' },
            { title: 'Tools Hub', desc: 'Temp mail, SMS, passwords, and more.', path: '/tools', icon: Wrench, accent: 'border-[#00aeef]/30 hover:border-[#00aeef]/60' },
            { title: 'Legal Hub', desc: 'Terms, rules, privacy — same as Discord /legal.', path: '/legal', icon: Shield, accent: 'border-amber-500/30 hover:border-amber-500/60' },
            { title: 'Discovery Scan', desc: user?.isAdmin ? 'Quick or deep web scan for new casinos.' : 'Admin sign-in required.', path: user?.isAdmin ? '/discovery' : '/login?next=/discovery', icon: Radar, accent: 'border-[#00aeef]/30 hover:border-[#00aeef]/60' },
            { title: 'Review Queue', desc: user?.isAdmin ? 'Approve discoveries and user reports.' : 'Admin sign-in required.', path: user?.isAdmin ? '/review' : '/login?next=/review', icon: Flag, accent: 'border-amber-500/30 hover:border-amber-500/60' },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.06 }}
            >
              <Link
                to={item.path}
                className={`block p-4 rounded-xl bg-[#1a1a22]/80 border ${item.accent}
                           hover:shadow-[0_0_24px_rgba(0,174,239,0.1)] transition-all h-full group`}
              >
                <item.icon className="w-5 h-5 text-[#b87333] mb-2 group-hover:text-[#00aeef] transition-colors" />
                <h3 className="font-medium mb-1 text-white">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>

        {stats?.lastDiscoveryAt && (
          <p className="text-sm text-gray-500 mt-6 pt-4 border-t border-[#2a2a35]">
            Last discovery scan: {new Date(stats.lastDiscoveryAt).toLocaleString()}
          </p>
        )}
      </motion.div>
    </div>
  );
}
