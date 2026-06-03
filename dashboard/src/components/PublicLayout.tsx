import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ScrollText, Shield, ShieldCheck, Scale, Dices, LogIn, Keyboard } from 'lucide-react';
import SiteFooter from './SiteFooter';
import BrandLogo from './BrandLogo';
import BackToTop from './BackToTop';
import GlobalSearch from './GlobalSearch';
import MobileNav from './MobileNav';
import PageTransition from './PageTransition';
import ShortcutsHelp from './ShortcutsHelp';

const publicNavItems = [
  { to: '/legal', icon: Scale, label: 'Legal Hub' },
  { to: '/terms', icon: ScrollText, label: 'Terms' },
  { to: '/rules', icon: Shield, label: 'Rules' },
  { to: '/privacy', icon: ShieldCheck, label: 'Privacy' },
  { to: '/casinos', icon: Dices, label: 'Browse catalog' },
  { to: '/login', icon: LogIn, label: 'Sign in' },
];

export default function PublicLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col app-background relative overflow-hidden">
      <div className="hero-orb w-[420px] h-[420px] bg-glow/12 -top-40 -left-24 pointer-events-none" style={{ animationDelay: '0s' }} />
      <div className="hero-orb w-[320px] h-[320px] bg-brand/10 top-1/2 -right-28 pointer-events-none" style={{ animationDelay: '-3s' }} />
      <div className="absolute inset-0 app-background-grid pointer-events-none opacity-40" />
      <header className="sticky top-0 z-20 border-b border-surface-border px-4 sm:px-6 py-3 bg-surface-raised/80 backdrop-blur-xl relative">
        <div className="flex items-center gap-3">
          <MobileNav items={publicNavItems} />
          <Link to="/" className="hover:opacity-90 transition-opacity shrink-0">
            <BrandLogo size="md" />
          </Link>
          <div className="hidden sm:block flex-1 min-w-0 max-w-md">
            <GlobalSearch />
          </div>
          <nav className="hidden md:flex flex-wrap gap-4 text-sm shrink-0 ml-auto items-center">
            <Link to="/legal" className="text-gray-400 hover:text-glow">
              Legal
            </Link>
            <Link to="/terms" className="text-gray-400 hover:text-glow">
              Terms
            </Link>
            <Link to="/rules" className="text-gray-400 hover:text-glow">
              Rules
            </Link>
            <Link to="/privacy" className="text-gray-400 hover:text-glow">
              Privacy
            </Link>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('method-open-shortcuts'))}
              className="p-1.5 rounded-lg border border-white/10 text-gray-500 hover:text-glow hover:border-glow/30 transition-colors hidden lg:flex items-center gap-1"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <kbd className="kbd text-[9px]">?</kbd>
            </button>
            <Link to="/login" className="text-glow hover:underline font-medium">
              Sign in
            </Link>
          </nav>
        </div>
        <div className="sm:hidden mt-3">
          <GlobalSearch />
        </div>
      </header>
      <main className="flex-1 overflow-auto relative z-10">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
      <SiteFooter />
      <BackToTop />
      <ShortcutsHelp />
    </div>
  );
}
