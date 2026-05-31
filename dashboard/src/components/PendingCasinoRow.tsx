import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ExternalLink, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Casino, SimilarCasinoMatch } from '../types';
import { FEATURE_LABELS } from '../types';

interface Props {
  casino: Casino;
  onApprove: () => void;
  onReject: () => void;
}

export default function PendingCasinoRow({ casino, onApprove, onReject }: Props) {
  const [similar, setSimilar] = useState<SimilarCasinoMatch[]>([]);

  useEffect(() => {
    api.getSimilar({ casinoId: casino.id, limit: 3 })
      .then((r) => setSimilar(r.matches))
      .catch(() => {});
  }, [casino.id]);

  const featureChips = casino.features.slice(0, 6);

  return (
    <motion.div layout className="glass-glow p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold">{casino.name}</h3>
            {casino.rating > 0 && (
              <span className="text-xs text-amber-400 flex items-center gap-0.5">
                <Star className="w-3 h-3 fill-amber-400" />
                {casino.rating.toFixed(1)}
              </span>
            )}
          </div>
          <a href={casino.url} target="_blank" rel="noreferrer" className="text-sm text-glow hover:underline break-all">
            {casino.url}
          </a>
          {casino.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{casino.description}</p>
          )}
          {featureChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {featureChips.map((f) => (
                <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-overlay border border-surface-border text-gray-400">
                  {FEATURE_LABELS[f] ?? f}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Link
            to={`/tools/checker?url=${encodeURIComponent(casino.url)}`}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-surface-border text-gray-400 hover:text-glow text-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Check
          </Link>
          <button
            type="button"
            onClick={onApprove}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-accent-green/20 text-accent-green border border-accent-green/30 text-sm"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={onReject}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-accent-red/20 text-accent-red border border-accent-red/30 text-sm"
          >
            Reject
          </button>
        </div>
      </div>

      {similar.length > 0 && (
        <div className="pt-2 border-t border-surface-border/60">
          <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Similar in catalog — check for duplicates
          </p>
          <div className="flex flex-wrap gap-2">
            {similar.map((m) => (
              <span key={m.casino.id} className="text-xs text-gray-400">
                {m.casino.name}
                <span className="text-gray-600 ml-1">({Math.round(m.score * 100)}%)</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
