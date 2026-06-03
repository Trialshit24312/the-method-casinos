import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dices, RefreshCw, Star, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import type { Casino, CasinoFeature } from '../types';
import { FEATURE_LABELS } from '../types';
import PageHeader from '../components/PageHeader';
import CasinoCard from '../components/CasinoCard';
import EmptyState from '../components/EmptyState';
import { usePageTitle } from '../hooks/usePageTitle';

const FILTER_CHIPS: { label: string; noPhone?: boolean; vpn?: boolean; features?: CasinoFeature[] }[] = [
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
        vpn: chip.vpn,
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
    <div className="p-8 max-w-3xl mx-auto">
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
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              activeChip === i
                ? 'border-glow/40 bg-glow/10 text-glow'
                : 'border-white/10 text-gray-400 hover:text-white'
            }`}
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

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {pick && !loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass-glow p-4 mb-4 border-glow/20">
            <p className="text-xs text-gray-500 uppercase mb-2">Your pick</p>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-xl font-bold text-white">{pick.name}</h2>
              {pick.verified && <ShieldCheck className="w-5 h-5 text-emerald-400" />}
              <span className="flex items-center gap-1 text-amber-400 text-sm">
                <Star className="w-4 h-4 fill-current" />
                {pick.rating.toFixed(1)}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-2 line-clamp-2">{pick.description || 'Verified sweepstakes operator'}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {pick.features.slice(0, 6).map((f) => (
                <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400">
                  {FEATURE_LABELS[f] ?? f}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 text-sm">
              <Link to={`/casinos/${pick.urlNormalized ?? pick.id}`} className="text-glow hover:underline">
                Full profile →
              </Link>
              <Link to={`/similar?casino=${pick.id}`} className="text-glow hover:underline">
                Find similar →
              </Link>
            </div>
          </div>
          <CasinoCard casino={pick} index={0} />
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
