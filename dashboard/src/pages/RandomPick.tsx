import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dices, RefreshCw, Scale, Sparkles } from 'lucide-react';
import RandomPickSkeleton from '../components/RandomPickSkeleton';
import QuickLinkRow from '../components/QuickLinkRow';
import RecentlyViewed from '../components/RecentlyViewed';
import NoticeBanner from '../components/NoticeBanner';
import { api } from '../api';
import type { Casino, CasinoFeature } from '../types';
import PageHeader from '../components/PageHeader';
import CasinoCard from '../components/CasinoCard';
import EmptyState from '../components/EmptyState';
import Breadcrumb from '../components/Breadcrumb';
import ErrorBanner from '../components/ErrorBanner';
import { usePageTitle } from '../hooks/usePageTitle';
import { useCasinoFavorites } from '../hooks/useCasinoFavorites';
import { useTimedNotice } from '../hooks/useTimedNotice';

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
  const { isFavorited, toggleFavorite } = useCasinoFavorites();
  const { message: favNotice, show: showFavNotice } = useTimedNotice(3000);
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

  const handleToggleFavorite = () => {
    if (!pick) return;
    void toggleFavorite(pick)
      .then((added) => showFavNotice(added ? 'Saved to My List' : 'Removed from My List'))
      .catch((e) => showFavNotice(e instanceof Error ? e.message : 'Could not update My List'));
  };

  return (
    <div className="page-container-narrow">
      <Breadcrumb items={[{ label: 'Catalog', to: '/casinos' }, { label: 'Random pick' }]} />
      <PageHeader
        icon={<Dices className="w-6 h-6 text-glow" />}
        title="Random Casino"
        subtitle="Same engine as Discord /random — spin the catalog with optional filters"
      />

      <RecentlyViewed />

      {favNotice && <NoticeBanner message={favNotice} variant="success" />}

      <div className="flex flex-wrap gap-2 mb-6 animate-stagger">
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

      {loading && <RandomPickSkeleton />}

      {pick && !loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Your pick</p>
          <CasinoCard
            casino={pick}
            index={0}
            favorited={isFavorited(pick.id)}
            onToggleFavorite={handleToggleFavorite}
          />
          <QuickLinkRow
            links={[
              { to: `/casinos/${pick.urlNormalized ?? pick.id}`, label: 'Full profile' },
              { to: `/similar?casino=${pick.id}`, label: 'Find similar', icon: Sparkles },
              { to: `/compare?a=${encodeURIComponent(pick.id)}`, label: 'Compare', icon: Scale },
            ]}
          />
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
