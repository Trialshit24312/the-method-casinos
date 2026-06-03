import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Heart, StickyNote, Copy, Download } from 'lucide-react';
import { api } from '../api';
import type { Casino } from '../types';
import PageHeader from '../components/PageHeader';
import CasinoCard from '../components/CasinoCard';
import EmptyState from '../components/EmptyState';
import CatalogGridSkeleton from '../components/CatalogGridSkeleton';
import ErrorBanner from '../components/ErrorBanner';
import Breadcrumb from '../components/Breadcrumb';
import NoticeBanner from '../components/NoticeBanner';
import { useTimedNotice } from '../hooks/useTimedNotice';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { readGuestFavorites, removeGuestFavorite } from '../lib/guest-favorites';

interface FavoriteRow {
  casino: Casino;
  note: string | null;
}

function FavoriteNote({ casinoId, initial }: { casinoId: string; initial: string | null }) {
  const [note, setNote] = useState(initial ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initial ?? '');

  const scheduleSave = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (value === lastSaved.current) return;
      api.setFavoriteNote(casinoId, value)
        .then(() => { lastSaved.current = value; })
        .catch(() => { /* silent — user can retry by editing */ });
    }, 600);
  };

  return (
    <div className="mt-2 px-1">
      <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-600 mb-1">
        <StickyNote className="w-3 h-3" /> Personal note
      </label>
      <textarea
        className="input-field w-full text-sm min-h-[56px] resize-y"
        placeholder="Signup email, promo code, last played…"
        value={note}
        maxLength={500}
        onChange={(e) => {
          setNote(e.target.value);
          scheduleSave(e.target.value);
        }}
      />
    </div>
  );
}

export default function MyList() {
  usePageTitle('My List — The Method Casinos');
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { message: noticeMsg, show: showNotice } = useTimedNotice();

  const load = () => {
    setLoading(true);
    setError('');
    if (!user) {
      setFavorites(readGuestFavorites().map((casino) => ({ casino, note: null })));
      setLoading(false);
      return;
    }
    api.getFavorites()
      .then(setFavorites)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    if (user) return;
    const refresh = () => load();
    window.addEventListener('method-guest-favorites', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('method-guest-favorites', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [user]);

  const removeFavorite = (casinoId: string) => {
    if (user) {
      api.removeFavorite(casinoId).then(load).catch(() => {});
    } else {
      removeGuestFavorite(casinoId);
      load();
    }
  };

  return (
    <div className="page-container-narrow">
      <Breadcrumb items={[{ label: 'Catalog', to: '/casinos' }, { label: 'My list' }]} />
      <PageHeader
        title="My List"
        subtitle={
          user
            ? 'Saved casinos with private notes — synced with Discord /mylist when signed in'
            : 'Saved locally in your browser — sign in to sync with Discord /mylist'
        }
        icon={<Heart className="w-6 h-6 text-rose-400" />}
        action={
          favorites.length > 0 ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-sm flex items-center gap-1.5"
                onClick={() => {
                  const text = favorites
                    .map((f) => {
                      const note = f.note?.trim();
                      return note
                        ? `• ${f.casino.name} — ${f.casino.url}\n  Note: ${note}`
                        : `• ${f.casino.name} — ${f.casino.url}`;
                    })
                    .join('\n');
                  void navigator.clipboard.writeText(text);
                  showNotice('List copied to clipboard');
                }}
              >
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button
                type="button"
                className="btn-secondary text-sm flex items-center gap-1.5"
                onClick={() => {
                  const blob = new Blob(
                    [JSON.stringify(favorites, null, 2)],
                    { type: 'application/json' },
                  );
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'my-list.json';
                  a.click();
                  URL.revokeObjectURL(a.href);
                  showNotice('List exported as JSON');
                }}
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
          ) : undefined
        }
      />

      {!user && (
        <div className="mb-6 p-4 rounded-xl border border-glow/20 bg-glow/5 text-sm text-gray-400">
          Browsing as guest — favorites are stored on this device only.{' '}
          <Link to="/login?next=/mylist" className="text-glow hover:underline">Sign in with Discord</Link>
          {' '}to sync across devices and Discord.
        </div>
      )}

      {noticeMsg && <NoticeBanner message={noticeMsg} variant="success" />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading && <CatalogGridSkeleton count={3} />}

      {!loading && favorites.length === 0 && (
        <EmptyState
          icon={Heart}
          title="No saved casinos yet"
          description="Tap the heart on any casino card or profile to build your personal list."
          action={<Link to="/casinos" className="btn-glow text-sm">Browse catalog</Link>}
        />
      )}

      {!loading && favorites.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-stagger">
          {favorites.map(({ casino, note }, i) => (
            <div key={casino.id} className="flex flex-col">
              <CasinoCard
                casino={casino}
                index={i}
                onToggleFavorite={() => removeFavorite(casino.id)}
                favorited
              />
              {user && <FavoriteNote casinoId={casino.id} initial={note} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
