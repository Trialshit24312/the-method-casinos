import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dices, Shield, Radar, Wrench, ArrowRight, Sparkles, ShieldCheck, Globe, Zap, Star, Crown } from 'lucide-react';
import { api } from '../api';
import type { Stats, Casino } from '../types';
import { discordInviteUrl } from '../lib/site';
import SiteFooter from '../components/SiteFooter';
import FeatureStrip from '../components/FeatureStrip';
import CasinoCarousel from '../components/CasinoCarousel';
import CarouselSkeleton from '../components/CarouselSkeleton';
import PricingTiers from '../components/PricingTiers';
import { usePageTitle } from '../hooks/usePageTitle';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

export default function Landing() {
  usePageTitle('The Method Casinos — Verified US Sweepstakes Catalog');
  const [stats, setStats] = useState<Stats | null>(null);
  const [featured, setFeatured] = useState<Casino[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const discordInvite = discordInviteUrl();

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
    setFeaturedLoading(true);
    api.getFeaturedCasinos(6)
      .then(setFeatured)
      .catch(() => {})
      .finally(() => setFeaturedLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col app-background relative overflow-hidden">
      <div className="hero-orb w-[480px] h-[480px] bg-glow/20 -top-32 -left-32" style={{ animationDelay: '0s' }} />
      <div className="hero-orb w-[360px] h-[360px] bg-brand/15 top-1/3 -right-32" style={{ animationDelay: '-4s' }} />
      <div className="absolute inset-0 app-background-grid pointer-events-none opacity-70" />

      <header className="relative border-b border-white/[0.06] bg-surface-raised/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 blur-lg bg-glow/25 rounded-full scale-125 opacity-0 group-hover:opacity-100 transition-opacity" />
              <img src="/logo.png" alt="" className="relative w-10 h-10 drop-shadow-method-glow" />
            </div>
            <div>
              <span className="font-display font-bold tracking-wide block">THE METHOD</span>
              <span className="tagline">Casinos Hub</span>
            </div>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link to="/casinos" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline">
              Browse
            </Link>
            <Link to="/similar" className="text-sm text-gray-400 hover:text-glow transition-colors hidden sm:inline">
              Similar
            </Link>
            <Link to="/pricing" className="text-sm text-gray-400 hover:text-brand-light transition-colors hidden sm:inline">
              Membership
            </Link>
            <Link to="/tools/checker" className="text-sm text-gray-400 hover:text-white transition-colors hidden md:inline">
              URL Check
            </Link>
            <Link to="/login" className="text-sm px-3 py-1.5 rounded-lg border border-glow/30 text-glow hover:bg-glow/10 transition-colors">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative flex-1 max-w-6xl mx-auto px-4 py-12 md:py-20 w-full">
        <motion.section {...fadeUp} className="text-center mb-20 relative z-10 pt-4">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, type: 'spring', stiffness: 120 }}
            className="pro-badge mb-8"
          >
            <Zap className="w-3.5 h-3.5" />
            Verified catalog · Free web discovery · Zero API keys
          </motion.div>

          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 leading-[1.08] tracking-tight">
            <span className="text-gradient-brand">US Sweepstakes</span>
            <span className="block text-white mt-2">Casinos Hub</span>
          </h1>

          <p className="text-gray-400 max-w-xl mx-auto mb-12 text-lg leading-relaxed">
            Professional-grade catalog, scam protection, and discovery tools — built for operators who want real sites, not listicles.
          </p>

          <div className="flex flex-wrap gap-3 justify-center mb-12">
            <Link to="/casinos" className="btn-primary inline-flex items-center gap-2 px-7 py-3 text-base">
              Browse casinos <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/similar" className="btn-glow inline-flex items-center gap-2 px-7 py-3 text-base">
              <Sparkles className="w-4 h-4" /> Find similar
            </Link>
            <Link to="/tools/checker" className="btn-secondary inline-flex items-center gap-2 px-7 py-3 text-base">
              <ShieldCheck className="w-4 h-4" /> Check URL
            </Link>
            <Link to="/pricing" className="inline-flex items-center gap-2 px-7 py-3 rounded-lg border border-brand/40 bg-brand/10 text-brand-light hover:bg-brand/20 transition-all font-medium">
              <Crown className="w-4 h-4" /> Membership
            </Link>
            {discordInvite && (
              <a
                href={discordInvite}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-lg bg-[#5865F2]/15 border border-[#5865F2]/40 text-[#5865F2] hover:bg-[#5865F2]/25 transition-all font-medium"
              >
                Join Discord
              </a>
            )}
          </div>

          <FeatureStrip compact />
        </motion.section>

        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
          >
            {[
              { label: 'Verified casinos', value: stats.verifiedCasinos, icon: Shield, accent: 'text-emerald-400' },
              { label: 'No phone signup', value: stats.noPhoneCasinos, icon: Dices, accent: 'text-glow' },
              { label: 'Blocked scams', value: stats.blockedSites, icon: ShieldCheck, accent: 'text-red-400' },
              { label: 'Email only', value: stats.emailOnlyCasinos, icon: Wrench, accent: 'text-brand-light' },
            ].map(({ label, value, icon: Icon, accent }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="stat-card text-center card-shine"
              >
                <Icon className={`w-5 h-5 ${accent} mx-auto mb-2`} />
                <p className="text-3xl font-display font-bold text-white">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {featuredLoading ? (
          <div className="mb-16 px-2">
            <CarouselSkeleton title="Featured casinos" cards={3} />
          </div>
        ) : featured.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className="mb-16 px-2"
          >
            <CasinoCarousel
              title="Featured casinos"
              subtitle="Hand-picked verified operators"
              casinos={featured}
              icon={<Star className="w-5 h-5 text-brand-light" />}
              action={
                <Link to="/casinos" className="text-sm text-glow hover:underline flex items-center gap-1">
                  Browse all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            />
          </motion.div>
        )}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
          className="mb-16 relative z-10"
        >
          <PricingTiers compact />
          <div className="text-center mt-6">
            <Link to="/pricing" className="text-sm text-glow hover:underline inline-flex items-center gap-1">
              Full tier breakdown <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mb-12"
        >
          <h2 className="font-display text-lg text-center text-gray-400 mb-6">Explore the platform</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { to: '/casinos', title: 'Casino catalog', desc: 'Filter by features — slots, VPN, email-only, redeem options.', icon: Dices, color: 'from-[#b87333]/20 to-transparent' },
              { to: '/similar', title: 'Similar Casinos', desc: 'Match from catalog or search DuckDuckGo, Bing & Brave for alike sites.', icon: Sparkles, color: 'from-[#00aeef]/20 to-transparent' },
              { to: '/tools', title: 'Signup tools', desc: 'Email, phone, password generators and URL checker.', icon: Wrench, color: 'from-[#b87333]/15 to-transparent' },
              { to: '/tools/checker', title: 'URL safety', desc: 'Instant blocklist + catalog lookup before you click.', icon: ShieldCheck, color: 'from-emerald-500/15 to-transparent' },
              { to: '/blocked', title: 'Blocklist', desc: 'Known scam and phishing URLs — never sign up here.', icon: Globe, color: 'from-red-500/15 to-transparent' },
              { to: '/legal', title: 'Legal Hub', desc: 'Terms, rules, privacy — same as Discord /legal.', icon: Shield, color: 'from-amber-500/10 to-transparent' },
              { to: '/pricing', title: 'Membership', desc: 'Four monthly tiers — Scout to Architect. Preview pricing, no checkout yet.', icon: Crown, color: 'from-brand/20 to-transparent' },
            ].map(({ to, title, desc, icon: Icon, color }, i) => (
              <motion.div key={to} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.04 }}>
                <Link
                  to={to}
                  className={`glass-glow p-5 h-full block card-shine bg-gradient-to-br ${color} hover:border-glow/35 transition-all group`}
                >
                  <div className="p-2.5 rounded-lg bg-surface-overlay/80 border border-surface-border w-fit mb-3 group-hover:border-glow/30 transition-colors">
                    <Icon className="w-5 h-5 text-glow" />
                  </div>
                  <h3 className="font-display font-semibold mb-1.5 group-hover:text-glow transition-colors">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {discordInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="border-gradient rounded-2xl p-6 md:p-8 text-center"
          >
            <Radar className="w-8 h-8 text-glow mx-auto mb-3" />
            <h2 className="font-display text-xl font-bold mb-2">Also on Discord</h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto mb-4">
              Use slash commands for search, similar casinos with web discovery, URL checks, and filters — synced with this dashboard.
            </p>
            <a href={discordInvite} target="_blank" rel="noreferrer" className="btn-glow inline-flex items-center gap-2">
              Open Discord server
            </a>
          </motion.div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
