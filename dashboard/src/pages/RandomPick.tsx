import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dices, RefreshCw } from 'lucide-react';
import { api } from '../api';
import type { Casino, CasinoFeature } from '../types';
import PageHeader from '../components/PageHeader';
import CasinoCard from '../components/CasinoCard';
import EmptyState from '../components/EmptyState';
import Breadcrumb from '../components/Breadcrumb';
import ErrorBanner from '../components/ErrorBanner';
import { usePageTitle } from '../hooks/usePageTitle';

const FILTER_CHIPS: { label: string; noPhone?: boolean; features?: CasinoFeature[] }[] = [
  { label: 'Any verified' },
  { label: 'No phone', noPhone: true },
  { label: 'Slots', features: ['slots'] },
  { label: 'Live games', features: ['live_games'] },
  { label: 'VPN OK', features: ['vpn_allowed'] },
  { label: 'Fast payout', features: ['fast_payout'] },
];

export default function RandomPick() {
  usePageTitle('Random Casino — The Method');
  const [pick, setPick] = useState<Casino | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeChip, setActiveChip] = useState(0);

  const roll = async (chipIndex = activeChip) => {
    const chip = FILTER_CHIPS[chipIndex] ?? FILTER_CHIPS[0];
    setLoading(true);
    setError('');
    setActiveChip(chipIndex);
    try {
      const casino = await api.getRandomCasino({
        noPhone: chip.noPhone,
        features: chip.features,
      });
      if (!casino) {
        setPick(null);
        setError('No casinos match those filters. Try a broader preset.');
        return;
      }
      setPick(casino);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to pick');
      setPick(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container-narrow">
      <Breadcrumb items={[{ label: 'Catalog', to: '/casinos' }, { label: 'Random pick' }]} />
      <PageHeader
        icon={<Dices className="w-6 h-6 text-glow" />}
        title="Random Casino"
        subtitle="Same engine as Discord /random — spin the catalog with optional filters"
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_CHIPS.map((chip, i) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => void roll(i)}
            className={`chip ${activeChip === i ? 'chip-active' : ''}`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => void roll()}
        className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 mb-6 disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Picking…' : pick ? 'Pick another' : 'Roll random casino'}
      </button>

      {error && <ErrorBanner message={error} onRetry={() => void roll()} variant="warning" />}

      {pick && !loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Your pick</p>
          <CasinoCard casino={pick} index={0} />
          <div className="flex flex-wrap gap-4 text-sm">
            <Link to={`/casinos/${pick.urlNormalized ?? pick.id}`} className="text-glow hover:underline">
              Full profile →
            </Link>
            <Link to={`/similar?casino=${pick.id}`} className="text-glow hover:underline">
              Find similar →
            </Link>
          </div>
        </motion.div>
      )}

      {!pick && !loading && !error && (
        <EmptyState
          icon={Dices}
          title="Ready to roll"
          description="Choose a filter preset above, then spin the verified catalog — same engine as Discord /random."
          action={
            <button type="button" onClick={() => void roll()} className="btn-primary text-sm">
              Roll now
            </button>
          }
        />
      )}
    </div>
  );
}
