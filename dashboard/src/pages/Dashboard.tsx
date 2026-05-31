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
  ShieldOff,
  Radar,
  Wrench,
  Ban,
  BookOpen,
  Star,
} from 'lucide-react';
import { api } from '../api';
import type { Stats, Casino } from '../types';
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title={`Welcome back, ${user?.username}`}
        subtitle="Your sweepstakes casino command center — browse, discover, and signup with the right tools"
      />

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Casinos" value={stats.totalCasinos} icon={Dices} color="bg-[#b87333]/20 text-[#d4956a]" delay={0} />
          <StatCard label="Verified" value={stats.verifiedCasinos} icon={ShieldCheck} color="bg-emerald-500/20 text-emerald-300" delay={0.05} />
          <StatCard label="No Phone Required" value={stats.noPhoneCasinos} icon={PhoneOff} color="bg-[#00aeef]/20 text-[#00aeef]" delay={0.1} />
          <StatCard label="Email Only Signup" value={stats.emailOnlyCasinos} icon={Mail} color="bg-violet-500/20 text-violet-300" delay={0.15} />
          <StatCard label="With Slots" value={stats.withSlots} icon={Sparkles} color="bg-amber-500/20 text-amber-300" delay={0.2} />
          <StatCard label="Live Games" value={stats.withLiveGames} icon={Radio} color="bg-rose-500/20 text-rose-300" delay={0.25} />
          <StatCard label="VPN Allowed" value={stats.vpnAllowedCasinos} icon={Shield} color="bg-emerald-500/20 text-emerald-300" delay={0.3} />
          <StatCard label="Blocked Sites" value={stats.blockedSites} icon={Ban} color="bg-red-500/20 text-red-400" delay={0.35} />
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
            { title: 'Browse Casinos', desc: 'Filter by VPN, payout, KYC, and more.', path: '/casinos', icon: Dices, accent: 'border-[#b87333]/30 hover:border-[#b87333]/60' },
            { title: 'Similar Casinos', desc: 'Pick a casino — find alike sites by features.', path: '/similar', icon: Sparkles, accent: 'border-[#00aeef]/30 hover:border-[#00aeef]/60' },
            { title: 'The Method Guides', desc: 'Step-by-step signup & safety workflows.', path: '/guides', icon: BookOpen, accent: 'border-[#b87333]/30 hover:border-[#b87333]/60' },
            { title: 'URL Safety Checker', desc: 'Check if a link is safe before visiting.', path: '/tools/checker', icon: ShieldCheck, accent: 'border-emerald-500/30 hover:border-emerald-500/60' },
            { title: 'Run Discovery', desc: 'Quick (~3 min) or deep (~12 min) scan for new sites.', path: '/discovery', icon: Radar, accent: 'border-[#00aeef]/30 hover:border-[#00aeef]/60' },
            { title: 'Blocked Sites', desc: 'Scam, phishing, and dangerous URLs — auto-blocked.', path: '/blocked', icon: Ban, accent: 'border-red-500/30 hover:border-red-500/60' },
            { title: 'Tools Hub', desc: 'Temp mail, SMS, passwords, and more.', path: '/tools', icon: Wrench, accent: 'border-[#00aeef]/30 hover:border-[#00aeef]/60' },
            { title: 'Email Tools', desc: 'Working temp-mail links + identity generator.', path: '/tools/email', icon: Mail, accent: 'border-[#00aeef]/30 hover:border-[#00aeef]/60' },
            { title: 'Password Generator', desc: 'Strong unique passwords per casino.', path: '/tools/password', icon: ShieldOff, accent: 'border-[#b87333]/30 hover:border-[#b87333]/60' },
            { title: 'Phone Tools', desc: 'SMS receiver websites for OTP when needed.', path: '/tools/phone', icon: PhoneOff, accent: 'border-[#b87333]/30 hover:border-[#b87333]/60' },
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
