import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { readRecentlyViewed } from '../lib/recently-viewed';

const QUICK_LINKS = [
  { label: 'Casinos', path: '/casinos' },
  { label: 'New arrivals', path: '/new' },
  { label: 'Similar casinos', path: '/similar' },
  { label: 'Compare', path: '/compare' },
  { label: 'Random pick', path: '/random' },
  { label: 'Compare', path: '/compare' },
  { label: 'Catalog help', path: '/assistant' },
  { label: 'Guides', path: '/guides' },
  { label: 'URL checker', path: '/tools/checker' },
  { label: 'My list', path: '/mylist' },
  { label: 'Status', path: '/status' },
  { label: 'Blocklist', path: '/blocked' },
  { label: 'Catalog help', path: '/assistant' },
];

const ADMIN_LINKS = [
  { label: 'Discovery', path: '/discovery' },
  { label: 'Review queue', path: '/review' },
  { label: 'Insights', path: '/insights' },
];

export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [recentViews, setRecentViews] = useState(readRecentlyViewed);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const refresh = () => setRecentViews(readRecentlyViewed());
    window.addEventListener('method-recent-view', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('method-recent-view', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const focusSearch = () => {
    if (location.pathname === '/casinos') {
      document.getElementById('catalog-search-input')?.focus();
      return;
    }
    setOpen(true);
    document.getElementById('global-search-input')?.focus();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        document.getElementById('global-search-input')?.focus();
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        focusSearch();
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [location.pathname]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    setOpen(false);
    navigate(`/casinos?q=${encodeURIComponent(trimmed)}`);
  };

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="relative w-full lg:max-w-md">
      <form onSubmit={submit}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
        <input
          id="global-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search casinos… (Ctrl+K or /)"
          className="input-field w-full pl-9 pr-3 py-2 text-sm"
        />
      </form>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-surface-border bg-surface-raised/95 backdrop-blur-xl shadow-xl p-2 max-h-[min(24rem,70vh)] overflow-y-auto">
          {recentViews.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wide text-gray-600 px-2 py-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Recently viewed
              </p>
              {recentViews.slice(0, 5).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onMouseDown={() => go(`/casinos/${v.slug}`)}
                  className="w-full text-left px-2 py-1.5 text-sm text-gray-400 hover:text-glow hover:bg-white/5 rounded-lg truncate"
                >
                  {v.name}
                </button>
              ))}
            </>
          )}
          <p className="text-[10px] uppercase tracking-wide text-gray-600 px-2 py-1 mt-1">Quick jump</p>
          {QUICK_LINKS.map((link) => (
            <button
              key={link.path}
              type="button"
              onMouseDown={() => go(link.path)}
              className="w-full text-left px-2 py-1.5 text-sm text-gray-400 hover:text-glow hover:bg-white/5 rounded-lg"
            >
              {link.label}
            </button>
          ))}
          {user?.isAdmin && (
            <>
              <p className="text-[10px] uppercase tracking-wide text-gray-600 px-2 py-1 mt-1">Admin</p>
              {ADMIN_LINKS.map((link) => (
                <button
                  key={link.path}
                  type="button"
                  onMouseDown={() => go(link.path)}
                  className="w-full text-left px-2 py-1.5 text-sm text-amber-400/80 hover:text-amber-300 hover:bg-white/5 rounded-lg"
                >
                  {link.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
