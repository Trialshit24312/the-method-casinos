import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Clock } from 'lucide-react';
import { api } from '../api';
import type { Casino } from '../types';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Breadcrumb from '../components/Breadcrumb';
import ErrorBanner from '../components/ErrorBanner';
import CasinoCard from '../components/CasinoCard';
import CatalogGridSkeleton from '../components/CatalogGridSkeleton';
import { usePageTitle } from '../hooks/usePageTitle';

import { readGuestFavorites, toggleGuestFavorite } from '../lib/guest-favorites';
import { useAuth } from '../context/AuthContext';

function formatAdded(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'Added today';
  if (days === 1) return 'Added yesterday';
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NewArrivals() {
  usePageTitle('New Arrivals — The Method Casinos');
  const { user } = useAuth();
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guestFavoriteIds, setGuestFavoriteIds] = useState(
    () => new Set(readGuestFavorites().map((c) => c.id)),
  );
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    api.getFavorites()
      .then((favs) => setFavoriteIds(new Set(favs.map((f) => f.casino.id))))
      .catch(() => setFavoriteIds(new Set()));
  }, [user]);

  useEffect(() => {
    const refresh = () => setGuestFavoriteIds(new Set(readGuestFavorites().map((c) => c.id)));
    window.addEventListener('method-guest-favorites', refresh);
    return () => window.removeEventListener('method-guest-favorites', refresh);
  }, []);

  const load = () => {
    setLoading(true);
    setError('');
    api.getNewArrivals(24)
      .then(setCasinos)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setCasinos([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: 'Catalog', to: '/casinos' }, { label: 'New arrivals' }]} />
      <PageHeader
        icon={<Sparkles className="w-6 h-6 text-glow" />}
        title="New Arrivals"
        subtitle="Recently approved sweepstakes casinos added to the verified catalog"
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <CatalogGridSkeleton count={6} />
      ) : casinos.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No new arrivals yet"
          description="Recently approved operators will appear here after the next review cycle."
          action={<Link to="/casinos" className="btn-glow text-sm">Browse catalog</Link>}
        />
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-6">
            {casinos.length} operator{casinos.length === 1 ? '' : 's'} — sorted by approval date.
            {' '}
            <Link to="/casinos" className="text-glow hover:underline">Browse full catalog →</Link>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-stagger">
            {casinos.map((casino, i) => (
              <div key={casino.id} className="relative">
                {casino.createdAt && (
                  <span className="absolute top-3 right-3 z-10 text-[10px] px-2 py-0.5 rounded-full border border-glow/25 bg-surface-raised/90 text-glow flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatAdded(casino.createdAt)}
                  </span>
                )}
                <CasinoCard
                  casino={casino}
                  index={i}
                  favorited={user ? favoriteIds.has(casino.id) : guestFavoriteIds.has(casino.id)}
                  onToggleFavorite={() => {
                    if (user) {
                      void (favoriteIds.has(casino.id)
                        ? api.removeFavorite(casino.id)
                        : api.addFavorite(casino.id)
                      ).then(() => {
                        setFavoriteIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(casino.id)) next.delete(casino.id);
                          else next.add(casino.id);
                          return next;
                        });
                      });
                    } else {
                      toggleGuestFavorite(casino);
                      setGuestFavoriteIds(new Set(readGuestFavorites().map((c) => c.id)));
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
