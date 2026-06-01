import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { api } from '../api';
import type { Casino } from '../types';
import PageHeader from '../components/PageHeader';
import CasinoCard from '../components/CasinoCard';
import { useAuth } from '../context/AuthContext';

export default function MyList() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Casino[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.getFavorites()
      .then(setFavorites)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!user) return <Navigate to="/login?next=/mylist" replace />;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        title="My List"
        subtitle="Saved casinos — synced with Discord /mylist when signed in"
        icon={<Heart className="w-6 h-6 text-rose-400" />}
      />

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading && <p className="text-gray-500">Loading…</p>}

      {!loading && favorites.length === 0 && (
        <div className="glass-glow p-10 text-center text-gray-500">
          <Heart className="w-10 h-10 mx-auto mb-3 text-gray-600" />
          <p>No saved casinos yet.</p>
          <p className="text-sm mt-2">
            Browse the{' '}
            <Link to="/casinos" className="text-glow hover:underline">catalog</Link>
            {' '}and tap the heart on any casino page.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {favorites.map((casino, i) => (
          <CasinoCard key={casino.id} casino={casino} index={i} />
        ))}
      </div>
    </div>
  );
}
