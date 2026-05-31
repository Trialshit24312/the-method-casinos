import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dices, Shield, Radar, Wrench, ArrowRight, Bot } from 'lucide-react';
import { api } from '../api';
import type { Stats } from '../types';
import { discordInviteUrl } from '../lib/site';
import SiteFooter from '../components/SiteFooter';

import { usePageTitle } from '../hooks/usePageTitle';

export default function Landing() {
  usePageTitle('The Method Casinos — Verified US Sweepstakes Catalog');
  const [stats, setStats] = useState<Stats | null>(null);
  const discordInvite = discordInviteUrl();

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col app-background">
      <header className="border-b border-surface-border bg-surface-raised/40 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="w-10 h-10" />
            <span className="font-display font-bold tracking-wide">THE METHOD</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/casinos" className="text-sm text-gray-400 hover:text-white transition-colors">
              Browse
            </Link>
            <Link to="/login" className="text-sm px-3 py-1.5 rounded-lg border border-glow/30 text-glow hover:bg-glow/10">
              Admin sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-16 w-full">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-14">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            US Sweepstakes Casinos
            <span className="block text-glow text-2xl md:text-3xl mt-2 font-normal">Verified catalog · No phone signup</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto mb-8">
            Real operators only. Search verified sweepstakes casinos, check URLs for scams, and use signup tools — powered by our Discord bot and admin-reviewed database.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/casinos"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-glow/20 border border-glow/40 text-glow font-medium hover:bg-glow/30 transition-colors"
            >
              Browse casinos <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/tools/checker"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-surface-border text-gray-300 hover:bg-surface-overlay transition-colors"
            >
              Check a URL
            </Link>
            {discordInvite && (
              <a
                href={discordInvite}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2] hover:bg-[#5865F2]/30 transition-colors"
              >
                Join Discord
              </a>
            )}
          </div>
        </motion.div>

        {stats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14"
          >
            {[
              { label: 'Verified casinos', value: stats.verifiedCasinos, icon: Shield },
              { label: 'No phone signup', value: stats.noPhoneCasinos, icon: Dices },
              { label: 'Blocked scams', value: stats.blockedSites, icon: Shield },
              { label: 'Email only', value: stats.emailOnlyCasinos, icon: Wrench },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="glass-glow p-4 text-center">
                <Icon className="w-5 h-5 text-glow mx-auto mb-2" />
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </motion.div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { to: '/casinos', title: 'Casino catalog', desc: 'Filter by features — slots, VPN, email-only, and more.', icon: Dices },
            { to: '/tools', title: 'Signup tools', desc: 'Email, phone, password generators and URL checker.', icon: Wrench },
            { to: '/assistant', title: 'AI Assistant', desc: 'Free Groq/Gemini chat — answers from verified catalog only.', icon: Bot },
            { to: '/legal', title: 'Legal Hub', desc: 'Terms, rules, privacy — same as Discord /legal.', icon: Shield },
            { to: '/discovery', title: 'Discovery (admin)', desc: 'Scan the web for new casino sites.', icon: Radar },
          ].map(({ to, title, desc, icon: Icon }) => (
            <Link key={to} to={to} className="glass-glow p-5 hover:border-glow/30 transition-colors group">
              <Icon className="w-6 h-6 text-glow mb-3" />
              <h2 className="font-semibold mb-1 group-hover:text-glow transition-colors">{title}</h2>
              <p className="text-sm text-gray-500">{desc}</p>
            </Link>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
