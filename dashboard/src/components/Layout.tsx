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
  Bot,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SiteFooter from './SiteFooter';
import { discordInviteUrl } from '../lib/site';
import { api } from '../api';

const mainNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/casinos', icon: Dices, label: 'Casinos' },
  { to: '/similar', icon: Sparkles, label: 'Similar Casinos' },
  { to: '/assistant', icon: Bot, label: 'AI Assistant' },
  { to: '/discovery', icon: Radar, label: 'Discovery', adminOnly: true },
  { to: '/review', icon: ShieldCheck, label: 'Review Queue', adminOnly: true },
  { to: '/blocked', icon: Ban, label: 'Blocked Sites' },
];

const toolsNav = [
  { to: '/tools', icon: Wrench, label: 'Tools Hub' },
  { to: '/tools/email', icon: Mail, label: 'Email Generator' },
  { to: '/tools/phone', icon: Phone, label: 'Phone Generator' },
  { to: '/tools/password', icon: KeyRound, label: 'Password Generator' },
  { to: '/tools/checker', icon: ShieldCheck, label: 'URL Checker' },
  { to: '/guides', icon: BookOpen, label: 'Guides' },
];

const legalNav = [
  { to: '/rules', icon: Shield, label: 'Rules' },
  { to: '/terms', icon: ScrollText, label: 'Terms of Service' },
  { to: '/privacy', icon: ShieldCheck, label: 'Privacy' },
];

function NavSection({ title, items, pendingCount = 0, reportCount = 0 }: {
  title: string;
  items: (typeof mainNav)[number][];
  pendingCount?: number;
  reportCount?: number;
}) {
  const { user } = useAuth();
  const visible = items.filter((item) => !('adminOnly' in item && item.adminOnly) || user?.isAdmin);
  if (!visible.length) return null;
  return (
    <div className="mb-4">
      <p className="section-title">{title}</p>
      <div className="space-y-0.5">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard' || item.to === '/tools'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-glow/10 text-glow border border-glow/30 shadow-method-glow'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-overlay border border-transparent'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="font-medium text-sm flex-1">{item.label}</span>
            {'adminOnly' in item && item.to === '/review' && (pendingCount + reportCount) > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                {pendingCount + reportCount}
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
  const discordInvite = discordInviteUrl();
  const [pendingCount, setPendingCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => {
    if (!user?.isAdmin) return;
    api.getStats().then((s) => {
      setPendingCount(s.pendingReview);
      setReportCount(s.openReports ?? 0);
    }).catch(() => {});
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
          <NavSection title="Main" items={mainNav} pendingCount={pendingCount} reportCount={reportCount} />
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

      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1">
          <Outlet />
        </div>
        <SiteFooter />
      </main>
    </div>
  );
}
