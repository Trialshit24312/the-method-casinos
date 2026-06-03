import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { api } from '../api';
import type { Casino } from '../types';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import CasinoCard from '../components/CasinoCard';
import CarouselSkeleton from '../components/CarouselSkeleton';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NewArrivals() {
  usePageTitle('New Arrivals — The Method Casinos');
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getNewArrivals(24)
      .then(setCasinos)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setCasinos([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        icon={<Sparkles className="w-6 h-6 text-glow" />}
        title="New Arrivals"
        subtitle="Recently approved sweepstakes casinos added to the verified catalog"
      />

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <CarouselSkeleton title="Loading" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {casinos.map((casino, i) => (
              <CasinoCard key={casino.id} casino={casino} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
