import { NavLink, Outlet, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Dices,
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
  Lock as LockIcon,
  Heart,
  Bell,
  Scale,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SiteFooter from './SiteFooter';
import GlobalSearch from './GlobalSearch';
import { discordInviteUrl } from '../lib/site';
import { api } from '../api';

const mainNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/casinos', icon: Dices, label: 'Casinos' },
  { to: '/mylist', icon: Heart, label: 'My List' },
  { to: '/similar', icon: Sparkles, label: 'Similar Casinos' },
  { to: '/compare', icon: Scale, label: 'Compare' },
  { to: '/blocked', icon: Ban, label: 'Blocked Sites' },
];

const adminNav = [
  { to: '/discovery', icon: Radar, label: 'Discovery' },
  { to: '/review', icon: ShieldCheck, label: 'Review Queue' },
];

const toolsNav = [
  { to: '/tools', icon: Wrench, label: 'Tools Hub' },
  { to: '/tools/email', icon: Mail, label: 'Email Generator' },
  { to: '/tools/phone', icon: Phone, label: 'Phone Generator' },
  { to: '/tools/password', icon: KeyRound, label: 'Password Generator' },
  { to: '/tools/checker', icon: ShieldCheck, label: 'URL Checker' },
  { to: '/status', icon: Activity, label: 'Status' },
  { to: '/guides', icon: BookOpen, label: 'Guides' },
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
  showAdminHint = false,
}: {
  title: string;
  items: (typeof mainNav)[number][];
  notifyTotal?: number;
  showAdminHint?: boolean;
}) {
  const { user } = useAuth();
  if (!items.length) return null;
  return (
    <div className="mb-4">
      <p className="section-title">{title}</p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const needsAdmin = showAdminHint && !user?.isAdmin;
          return (
            <NavLink
              key={item.to}
              to={needsAdmin ? `/login?next=${encodeURIComponent(item.to)}` : item.to}
              end={item.to === '/dashboard' || item.to === '/tools'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-glow/15 to-brand/10 text-glow border border-glow/35 shadow-method-glow'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface-overlay border border-transparent hover:border-surface-border'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="font-medium text-sm flex-1">{item.label}</span>
              {needsAdmin && <LockIcon className="w-3 h-3 text-gray-600" aria-label="Admin sign-in required" />}
              {item.to === '/review' && user?.isAdmin && notifyTotal > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center gap-0.5">
                  <Bell className="w-2.5 h-2.5" />
                  {notifyTotal}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const discordInvite = discordInviteUrl();
  const [notifyTotal, setNotifyTotal] = useState(0);

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

  return (
    <div className="min-h-screen flex app-background">
      <aside className="w-64 border-r border-surface-border flex flex-col bg-surface-raised/50 backdrop-blur-sm">
        <div className="p-5 border-b border-surface-border">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link to="/" className="flex flex-col items-center text-center hover:opacity-90 transition-opacity">
              <div className="relative mb-3">
                <div className="absolute inset-0 blur-xl bg-glow/20 rounded-full scale-110" />
                <img
                  src="/logo.png"
                  alt="The Method"
                  className="relative w-20 h-20 object-contain drop-shadow-method-glow"
                />
              </div>
              <h1 className="font-display font-bold text-lg tracking-wide text-white">THE METHOD</h1>
              <p className="tagline mt-1">Precision · Strategy · Execution</p>
              <p className="text-[10px] text-gray-600 mt-2 uppercase tracking-wider">Casinos Hub</p>
            </Link>
          </motion.div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <NavSection title="Main" items={mainNav} />
          <NavSection title="Admin" items={adminNav} notifyTotal={notifyTotal} showAdminHint />
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 border-t border-surface-border"
          >
            <div className="flex items-center gap-3 mb-3">
              <img
                src={user.avatarUrl}
                alt={user.username}
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
          </motion.div>
        ) : (
          <div className="p-4 border-t border-surface-border">
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
        <header className="relative z-10 border-b border-surface-border/60 bg-surface-raised/30 backdrop-blur-md px-6 py-3 hidden lg:block">
          <GlobalSearch />
        </header>
        <div className="flex-1 relative z-10">
          <Outlet />
        </div>
        <SiteFooter />
      </main>
    </div>
  );
}
