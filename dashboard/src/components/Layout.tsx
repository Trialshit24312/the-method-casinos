import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Dices,
  Shuffle,
  Radar,
  LogOut,
  Mail,
  Phone,
  Wrench,
  ScrollText,
  Shield,
  Ban,
  BookOpen,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Clock,
  Heart,
  Bell,
  Scale,
  Activity,
  Crown,
  BarChart3,
  Flag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SiteFooter from './SiteFooter';
import GlobalSearch from './GlobalSearch';
import PageTransition from './PageTransition';
import MobileNav from './MobileNav';
import UserAvatar from './UserAvatar';
import BrandLogo from './BrandLogo';
import { discordInviteUrl } from '../lib/site';
import { api } from '../api';
import ReportSiteModal from './ReportSiteModal';
import ShortcutsHelp from './ShortcutsHelp';

const mainNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/casinos', icon: Dices, label: 'Casinos' },
  { to: '/new', icon: Clock, label: 'New Arrivals' },
  { to: '/mylist', icon: Heart, label: 'My List' },
  { to: '/similar', icon: Sparkles, label: 'Similar Casinos' },
  { to: '/compare', icon: Scale, label: 'Compare' },
  { to: '/random', icon: Shuffle, label: 'Random' },
  { to: '/pricing', icon: Crown, label: 'Membership' },
  { to: '/blocked', icon: Ban, label: 'Blocked Sites' },
];

const adminNav = [
  { to: '/discovery', icon: Radar, label: 'Discovery' },
  { to: '/review', icon: ShieldCheck, label: 'Review Queue' },
  { to: '/insights', icon: BarChart3, label: 'Insights' },
];

const toolsNav = [
  { to: '/tools', icon: Wrench, label: 'Tools Hub' },
  { to: '/tools/email', icon: Mail, label: 'Email Generator' },
  { to: '/tools/phone', icon: Phone, label: 'Phone Generator' },
  { to: '/tools/password', icon: KeyRound, label: 'Password Generator' },
  { to: '/tools/checker', icon: ShieldCheck, label: 'URL Checker' },
  { to: '/status', icon: Activity, label: 'Status' },
  { to: '/guides', icon: BookOpen, label: 'Guides' },
  { to: '/assistant', icon: Sparkles, label: 'Catalog Help' },
];

const legalNav = [
  { to: '/legal', icon: Scale, label: 'Legal Hub' },
  { to: '/rules', icon: Shield, label: 'Rules' },
  { to: '/terms', icon: ScrollText, label: 'Terms of Service' },
  { to: '/privacy', icon: ShieldCheck, label: 'Privacy' },
];

function NavSection({
  title,
  items,
  notifyTotal = 0,
}: {
  title: string;
  items: (typeof mainNav)[number][];
  notifyTotal?: number;
}) {
  const { user } = useAuth();
  if (!items.length) return null;
  return (
    <div className="mb-4">
      <p className="section-title">{title}</p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard' || item.to === '/tools'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                isActive
                  ? 'nav-item-active text-glow'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-white/[0.04] border border-transparent'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="font-medium text-sm flex-1">{item.label}</span>
            {item.to === '/review' && user?.isAdmin && notifyTotal > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center gap-0.5">
                <Bell className="w-2.5 h-2.5" />
                {notifyTotal}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const discordInvite = discordInviteUrl();
  const [notifyTotal, setNotifyTotal] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!user?.isAdmin) return;
    api.getNotifications().then((n) => {
      setNotifyTotal(n.total);
    }).catch(() => {
      api.getStats().then((s) => {
        setNotifyTotal(s.pendingReview + (s.openReports ?? 0) + (s.failedHealthCasinos ?? 0));
      }).catch(() => {});
    });
  }, [user?.isAdmin]);

  const mobileNavItems = [
    ...mainNav,
    ...(user?.isAdmin ? adminNav : []),
    ...toolsNav,
    ...legalNav.slice(0, 2),
  ];

  return (
    <div className="min-h-screen flex app-background">
      <aside className="hidden lg:flex w-64 border-r border-white/[0.06] flex-col bg-surface-raised/80 backdrop-blur-xl">
        <div className="p-5 border-b border-white/[0.06]">
          <Link to="/" className="hover:opacity-90 transition-opacity group">
            <BrandLogo size="lg" orientation="vertical" />
          </Link>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <NavSection title="Main" items={mainNav} />
          {user?.isAdmin && <NavSection title="Admin" items={adminNav} notifyTotal={notifyTotal} />}
          <NavSection title="Tools" items={toolsNav} />
          <NavSection title="Legal" items={legalNav} />
          {discordInvite && (
            <a
              href={discordInvite}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-3 py-2 mt-2 rounded-lg text-sm font-medium
                         text-[#5865F2] hover:bg-[#5865F2]/10 border border-[#5865F2]/30 transition-colors"
            >
              Join Discord Server
            </a>
          )}
        </nav>

        {user ? (
          <div className="p-4 border-t border-white/[0.06]">
            <div className="flex items-center gap-3 mb-3">
              <UserAvatar
                user={user}
                className="w-9 h-9 rounded-full ring-2 ring-glow/40"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.username}</p>
                <p className="text-xs text-brand-light/70">
                  {user.isAdmin ? 'Admin' : 'Member'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400
                         hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        ) : (
          <div className="p-4 border-t border-white/[0.06]">
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium
                         text-glow border border-glow/30 rounded-lg hover:bg-glow/10 transition-colors"
            >
              Admin sign in
            </Link>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto flex flex-col relative">
        <div className="absolute inset-0 app-background-grid pointer-events-none opacity-40" />
        <header className="relative z-10 border-b border-white/[0.06] bg-surface-raised/40 backdrop-blur-xl px-4 lg:px-6 py-3 flex items-center gap-3">
          <MobileNav
            items={mobileNavItems}
            footer={user ? (
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-accent-red rounded-lg"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            ) : (
              <Link to="/login" className="btn-glow w-full text-center text-sm block">Sign in</Link>
            )}
          />
          <Link to="/dashboard" className="lg:hidden shrink-0 font-display font-bold text-sm tracking-wide text-white hover:text-glow transition-colors">
            METHOD
          </Link>
          <div className="flex-1 min-w-0">
            <GlobalSearch />
          </div>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="shrink-0 p-2 rounded-xl border border-white/10 text-gray-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
            title="Report a site"
          >
            <Flag className="w-4 h-4" />
          </button>
          {user?.isAdmin && notifyTotal > 0 && (
            <Link
              to="/review"
              className="shrink-0 relative p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400"
              aria-label={`${notifyTotal} review items`}
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-0.5 rounded-full bg-amber-500 text-[10px] font-bold text-black flex items-center justify-center">
                {notifyTotal > 99 ? '99+' : notifyTotal}
              </span>
            </Link>
          )}
        </header>
        <ReportSiteModal open={reportOpen} onClose={() => setReportOpen(false)} />
        <ShortcutsHelp />
        <div className="flex-1 relative z-10">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </div>
        <SiteFooter />
      </main>
    </div>
  );
}
