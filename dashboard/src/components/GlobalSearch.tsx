import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';

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

  { label: 'Catalog help', path: '/assistant' },

  { label: 'Guides', path: '/guides' },

  { label: 'URL checker', path: '/tools/checker' },

  { label: 'My list', path: '/mylist' },

  { label: 'Status', path: '/status' },

  { label: 'Blocklist', path: '/blocked' },

];



const ADMIN_LINKS = [

  { label: 'Discovery', path: '/discovery' },

  { label: 'Review queue', path: '/review' },

  { label: 'Insights', path: '/insights' },

];



export default function GlobalSearch() {

  const [q, setQ] = useState('');

  const [open, setOpen] = useState(false);

  const [activeIndex, setActiveIndex] = useState(-1);

  const [recentViews, setRecentViews] = useState(readRecentlyViewed);

  const navigate = useNavigate();

  const location = useLocation();

  const { user } = useAuth();



  const dropdownItems = useMemo(() => {

    const recent = recentViews.slice(0, 5).map((v) => ({

      label: v.name,

      path: `/casinos/${v.slug}`,

      group: 'recent' as const,

    }));

    const quick = QUICK_LINKS.map((link) => ({ ...link, group: 'quick' as const }));

    const admin = user?.isAdmin

      ? ADMIN_LINKS.map((link) => ({ ...link, group: 'admin' as const }))

      : [];

    return [...recent, ...quick, ...admin];

  }, [recentViews, user?.isAdmin]);



  useEffect(() => {

    const refresh = () => setRecentViews(readRecentlyViewed());

    window.addEventListener('method-recent-view', refresh);

    window.addEventListener('storage', refresh);

    return () => {

      window.removeEventListener('method-recent-view', refresh);

      window.removeEventListener('storage', refresh);

    };

  }, []);



  useEffect(() => {

    setActiveIndex(-1);

  }, [open, q]);



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



  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {

    if (!open || dropdownItems.length === 0) return;

    if (e.key === 'ArrowDown') {

      e.preventDefault();

      setActiveIndex((i) => (i + 1) % dropdownItems.length);

    } else if (e.key === 'ArrowUp') {

      e.preventDefault();

      setActiveIndex((i) => (i <= 0 ? dropdownItems.length - 1 : i - 1));

    } else if (e.key === 'Enter' && activeIndex >= 0) {

      e.preventDefault();

      go(dropdownItems[activeIndex].path);

    }

  };



  let itemIndex = -1;



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

          onKeyDown={onInputKeyDown}

          placeholder="Search casinos…"

          className="input-field w-full pl-9 pr-16 py-2 text-sm"

        />

        <span className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 pointer-events-none">

          <kbd className="kbd">⌘K</kbd>

        </span>

      </form>

      {open && (

        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-surface-border bg-surface-raised/95 backdrop-blur-xl shadow-xl p-2 max-h-[min(24rem,70vh)] overflow-y-auto">

          {recentViews.length > 0 && (

            <>

              <p className="text-[10px] uppercase tracking-wide text-gray-600 px-2 py-1 flex items-center gap-1">

                <Clock className="w-3 h-3" /> Recently viewed

              </p>

              {recentViews.slice(0, 5).map((v) => {

                itemIndex += 1;

                const idx = itemIndex;

                return (

                  <button

                    key={v.id}

                    type="button"

                    onMouseDown={() => go(`/casinos/${v.slug}`)}

                    onMouseEnter={() => setActiveIndex(idx)}

                    className={`w-full text-left px-2 py-1.5 text-sm rounded-lg truncate ${

                      activeIndex === idx

                        ? 'text-glow bg-glow/10'

                        : 'text-gray-400 hover:text-glow hover:bg-white/5'

                    }`}

                  >

                    {v.name}

                  </button>

                );

              })}

            </>

          )}

          <p className="text-[10px] uppercase tracking-wide text-gray-600 px-2 py-1 mt-1">Quick jump</p>

          {QUICK_LINKS.map((link) => {

            itemIndex += 1;

            const idx = itemIndex;

            return (

              <button

                key={link.path}

                type="button"

                onMouseDown={() => go(link.path)}

                onMouseEnter={() => setActiveIndex(idx)}

                className={`w-full text-left px-2 py-1.5 text-sm rounded-lg ${

                  activeIndex === idx

                    ? 'text-glow bg-glow/10'

                    : 'text-gray-400 hover:text-glow hover:bg-white/5'

                }`}

              >

                {link.label}

              </button>

            );

          })}

          {user?.isAdmin && (

            <>

              <p className="text-[10px] uppercase tracking-wide text-gray-600 px-2 py-1 mt-1">Admin</p>

              {ADMIN_LINKS.map((link) => {

                itemIndex += 1;

                const idx = itemIndex;

                return (

                  <button

                    key={link.path}

                    type="button"

                    onMouseDown={() => go(link.path)}

                    onMouseEnter={() => setActiveIndex(idx)}

                    className={`w-full text-left px-2 py-1.5 text-sm rounded-lg ${

                      activeIndex === idx

                        ? 'text-amber-300 bg-amber-500/10'

                        : 'text-amber-400/80 hover:text-amber-300 hover:bg-white/5'

                    }`}

                  >

                    {link.label}

                  </button>

                );

              })}

            </>

          )}

        </div>

      )}

    </div>

  );

}

