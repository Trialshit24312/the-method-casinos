import { useEffect, useState, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Heart, StickyNote, Copy, Download } from 'lucide-react';
import { api } from '../api';
import type { Casino } from '../types';
import PageHeader from '../components/PageHeader';
import CasinoCard from '../components/CasinoCard';
import EmptyState from '../components/EmptyState';
import StatsSkeleton from '../components/StatsSkeleton';
import ErrorBanner from '../components/ErrorBanner';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';

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
  const [copyMsg, setCopyMsg] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api.getFavorites()
      .then(setFavorites)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!user) return <Navigate to="/login?next=/mylist" replace />;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="My List"
        subtitle="Saved casinos with private notes — synced with Discord /mylist when signed in"
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
                  setCopyMsg('List copied to clipboard');
                  setTimeout(() => setCopyMsg(''), 2500);
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
                }}
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
          ) : undefined
        }
      />

      {copyMsg && <p className="text-emerald-400 text-sm mb-4">{copyMsg}</p>}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading && <StatsSkeleton count={3} />}

      {!loading && favorites.length === 0 && (
        <EmptyState
          icon={Heart}
          title="No saved casinos yet"
          description="Tap the heart on any casino card or profile to build your personal list."
          action={<Link to="/casinos" className="btn-glow text-sm">Browse catalog</Link>}
        />
      )}

      {!loading && favorites.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {favorites.map(({ casino, note }, i) => (
            <div key={casino.id} className="flex flex-col">
              <CasinoCard
                casino={casino}
                index={i}
                onToggleFavorite={() => {
                  api.removeFavorite(casino.id).then(load).catch(() => {});
                }}
                favorited
              />
              <FavoriteNote casinoId={casino.id} initial={note} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
