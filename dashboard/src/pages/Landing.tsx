import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dices, Shield, Radar, Wrench, ArrowRight, Sparkles, ShieldCheck, Globe, Zap, Star, Crown, Search, Bot, Shuffle, Scale, LogIn } from 'lucide-react';
import { api } from '../api';
import type { Stats, Casino } from '../types';
import { discordInviteUrl } from '../lib/site';
import SiteFooter from '../components/SiteFooter';
import FeatureStrip from '../components/FeatureStrip';
import CasinoCarousel from '../components/CasinoCarousel';
import CarouselSkeleton from '../components/CarouselSkeleton';
import StatsSkeleton from '../components/StatsSkeleton';
import BrandLogo from '../components/BrandLogo';
import BackToTop from '../components/BackToTop';
import MobileNav from '../components/MobileNav';
import ActivityFeed from '../components/ActivityFeed';
import PricingTiers from '../components/PricingTiers';
import { usePageTitle } from '../hooks/usePageTitle';
import { useCasinoFavorites } from '../hooks/useCasinoFavorites';
import { useTimedNotice } from '../hooks/useTimedNotice';
import NoticeBanner from '../components/NoticeBanner';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const landingNavItems = [
  { to: '/casinos', icon: Dices, label: 'Browse' },
  { to: '/similar', icon: Sparkles, label: 'Similar' },
  { to: '/random', icon: Shuffle, label: 'Random' },
  { to: '/compare', icon: Scale, label: 'Compare' },
  { to: '/pricing', icon: Crown, label: 'Membership' },
  { to: '/tools/checker', icon: ShieldCheck, label: 'URL Check' },
  { to: '/login', icon: LogIn, label: 'Sign in' },
];

export default function Landing() {
  usePageTitle('The Method Casinos — Verified US Sweepstakes Catalog');
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [featured, setFeatured] = useState<Casino[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState(false);
  const [newArrivals, setNewArrivals] = useState<Casino[]>([]);
  const [heroQuery, setHeroQuery] = useState('');
  const navigate = useNavigate();
  const discordInvite = discordInviteUrl();
  const { isFavorited, toggleFavorite } = useCasinoFavorites();
  const { message: favNotice, show: showFavNotice } = useTimedNotice(3000);

  const handleCarouselFavorite = (casino: Casino) => {
    void toggleFavorite(casino)
      .then((added) => showFavNotice(added ? 'Saved to My List' : 'Removed from My List'))
      .catch((e) => showFavNotice(e instanceof Error ? e.message : 'Could not update My List'));
  };

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch(() => setStatsError(true))
      .finally(() => setStatsLoading(false));
    setFeaturedLoading(true);
    api.getFeaturedCasinos(6)
      .then(setFeatured)
      .catch(() => setFeaturedError(true))
      .finally(() => setFeaturedLoading(false));
    api.getNewArrivals(6).then(setNewArrivals).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col app-background relative overflow-hidden">
      <div className="hero-orb w-[480px] h-[480px] bg-glow/20 -top-32 -left-32" style={{ animationDelay: '0s' }} />
      <div className="hero-orb w-[360px] h-[360px] bg-brand/15 top-1/3 -right-32" style={{ animationDelay: '-4s' }} />
      <div className="absolute inset-0 app-background-grid pointer-events-none opacity-70" />

      <header className="relative border-b border-white/[0.06] bg-surface-raised/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <MobileNav items={landingNavItems} />
          <Link to="/" className="group shrink-0">
            <BrandLogo size="md" />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4 ml-auto">
            <Link to="/casinos" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline">
              Browse
            </Link>
            <Link to="/similar" className="text-sm text-gray-400 hover:text-glow transition-colors hidden sm:inline">
              Similar
            </Link>
            <Link to="/random" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline">
              Random
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

          <p className="text-gray-400 max-w-xl mx-auto mb-8 text-lg leading-relaxed">
            Professional-grade catalog, scam protection, and discovery tools — built for operators who want real sites, not listicles.
          </p>

          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              const q = heroQuery.trim();
              navigate(q ? `/casinos?q=${encodeURIComponent(q)}` : '/casinos');
            }}
            className="max-w-md mx-auto mb-10 relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
            <input
              value={heroQuery}
              onChange={(e) => setHeroQuery(e.target.value)}
              placeholder="Search the catalog…"
              className="input-field pl-11 pr-24 py-3 text-base"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 btn-glow text-sm px-4 py-1.5">
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {[
              { label: 'No phone', to: '/casinos?no_phone=1' },
              { label: 'Slots', to: '/casinos?feature=slots' },
              { label: 'Live games', to: '/casinos?feature=live_games' },
              { label: 'VPN OK', to: '/casinos?feature=vpn_allowed' },
              { label: 'Email only', to: '/casinos?feature=email_only' },
            ].map(({ label, to }) => (
              <Link key={to} to={to} className="chip text-xs hover:border-glow/30">
                {label}
              </Link>
            ))}
          </div>

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
                className="btn-discord-outline px-7 py-3"
              >
                Join Discord
              </a>
            )}
          </div>

          <FeatureStrip compact />
        </motion.section>

        {statsLoading ? (
          <div className="mb-16">
            <StatsSkeleton count={4} />
          </div>
        ) : statsError ? (
          <p className="text-center text-gray-500 text-sm mb-16">
            Live stats unavailable —{' '}
            <Link to="/status" className="text-glow hover:underline">check status</Link>
            {' '}or browse the catalog.
          </p>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16 animate-stagger">
            {[
              { label: 'Verified casinos', value: stats.verifiedCasinos, icon: Shield, accent: 'text-emerald-400', to: '/casinos' },
              { label: 'No phone signup', value: stats.noPhoneCasinos, icon: Dices, accent: 'text-glow', to: '/casinos?no_phone=1' },
              { label: 'Blocked scams', value: stats.blockedSites, icon: ShieldCheck, accent: 'text-red-400', to: '/blocked' },
              { label: 'Email only', value: stats.emailOnlyCasinos, icon: Wrench, accent: 'text-brand-light', to: '/casinos?feature=email_only' },
            ].map(({ label, value, icon: Icon, accent, to }) => (
              <Link key={label} to={to} className="stat-card text-center card-shine block hover:border-glow/30 transition-colors">
                <Icon className={`w-5 h-5 ${accent} mx-auto mb-2`} />
                <p className="text-3xl font-display font-bold text-white">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mb-16 px-2">
          {favNotice && (
            <div className="mb-4">
              <NoticeBanner message={favNotice} variant="success" />
            </div>
          )}
          <ActivityFeed />
        </div>

        {newArrivals.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="mb-16 px-2"
          >
            <CasinoCarousel
              title="New arrivals"
              subtitle="Recently approved for the public catalog"
              casinos={newArrivals}
              icon={<Zap className="w-5 h-5 text-glow" />}
              action={
                <Link to="/new" className="text-sm text-glow hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
              isFavorited={isFavorited}
              onToggleFavorite={handleCarouselFavorite}
            />
          </motion.div>
        ) : !featuredLoading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="mb-16 px-2 text-center"
          >
            <p className="text-sm text-gray-500 mb-3">
              New approvals land here after review
              {(stats?.pendingReview ?? 0) > 0 && (
                <> — {stats!.pendingReview} pending in queue</>
              )}
              .
            </p>
            <Link to="/casinos" className="btn-glow text-sm inline-flex items-center gap-1.5">
              Browse verified catalog <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        )}

        {featuredLoading ? (
          <div className="mb-16 px-2">
            <CarouselSkeleton title="Featured casinos" cards={3} />
          </div>
        ) : featuredError ? (
          <p className="text-center text-gray-500 text-sm mb-16 px-2">
            Featured picks unavailable —{' '}
            <Link to="/casinos" className="text-glow hover:underline">browse the full catalog</Link>.
          </p>
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
              isFavorited={isFavorited}
              onToggleFavorite={handleCarouselFavorite}
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-stagger">
            {[
              { to: '/casinos', title: 'Casino catalog', desc: 'Filter by features — slots, VPN, email-only, redeem options.', icon: Dices, color: 'from-brand/20 to-transparent' },
              { to: '/similar', title: 'Similar Casinos', desc: 'Match from catalog or search DuckDuckGo, Bing & Brave for alike sites.', icon: Sparkles, color: 'from-glow/20 to-transparent' },
              { to: '/random', title: 'Random pick', desc: 'Roll a verified casino with filters — same as Discord /random.', icon: Zap, color: 'from-glow/20 to-transparent' },
              { to: '/new', title: 'New arrivals', desc: 'Recently approved operators added to the verified catalog.', icon: Star, color: 'from-emerald-500/15 to-transparent' },
              { to: '/tools', title: 'Signup tools', desc: 'Email, phone, password generators and URL checker.', icon: Wrench, color: 'from-brand/15 to-transparent' },
              { to: '/assistant', title: 'Catalog help', desc: 'Ask questions about the catalog, filters, and signup workflows.', icon: Bot, color: 'from-glow/15 to-transparent' },
              { to: '/compare', title: 'Compare casinos', desc: 'Side-by-side feature and signup comparison.', icon: ShieldCheck, color: 'from-brand/15 to-transparent' },
              { to: '/tools/checker', title: 'URL safety', desc: 'Instant blocklist + catalog lookup before you click.', icon: ShieldCheck, color: 'from-emerald-500/15 to-transparent' },
              { to: '/blocked', title: 'Blocklist', desc: 'Known scam and phishing URLs — never sign up here.', icon: Globe, color: 'from-red-500/15 to-transparent' },
              { to: '/legal', title: 'Legal Hub', desc: 'Terms, rules, privacy — same as Discord /legal.', icon: Shield, color: 'from-amber-500/10 to-transparent' },
              { to: '/pricing', title: 'Membership', desc: 'Four monthly tiers — Scout to Architect. Preview pricing, no checkout yet.', icon: Crown, color: 'from-brand/20 to-transparent' },
            ].map(({ to, title, desc, icon: Icon, color }) => (
              <Link
                key={to}
                to={to}
                className={`glass-glow p-5 h-full block card-shine bg-gradient-to-br ${color} hover:border-glow/35 transition-all group`}
              >
                <div className="p-2.5 rounded-lg bg-surface-overlay/80 border border-surface-border w-fit mb-3 group-hover:border-glow/30 transition-colors">
                  <Icon className="w-5 h-5 text-glow" />
                </div>
                <h3 className="font-display font-semibold mb-1.5 group-hover:text-glow transition-colors">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </Link>
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
      <BackToTop />
    </div>
  );
}
