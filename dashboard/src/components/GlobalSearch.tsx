import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const QUICK_LINKS = [
  { label: 'Casinos', path: '/casinos' },
  { label: 'New arrivals', path: '/new' },
  { label: 'Similar casinos', path: '/similar' },
  { label: 'Compare', path: '/compare' },
  { label: 'Random pick', path: '/random' },
  { label: 'Guides', path: '/guides' },
  { label: 'URL checker', path: '/tools/checker' },
  { label: 'My list', path: '/mylist' },
  { label: 'Catalog help', path: '/assistant' },
  { label: 'Status', path: '/status' },
];

const ADMIN_LINKS = [
  { label: 'Discovery', path: '/discovery' },
  { label: 'Review queue', path: '/review' },
  { label: 'Insights', path: '/insights' },
];

export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

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
        setOpen(true);
        document.getElementById('global-search-input')?.focus();
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-surface-overlay/80 border border-surface-border
                     text-gray-200 placeholder-gray-600 focus:border-glow/40 focus:outline-none focus:ring-1 focus:ring-glow/30"
        />
      </form>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-surface-border bg-surface-raised/95 backdrop-blur-xl shadow-xl p-2">
          <p className="text-[10px] uppercase tracking-wide text-gray-600 px-2 py-1">Quick jump</p>
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
