import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ExternalLink, Star, ShieldCheck, Ban, Sparkles, Heart } from 'lucide-react';
import type { Casino } from '../types';
import { FEATURE_LABELS, FEATURE_COLORS, vpnLabel, formatTrackableValue } from '../types';
import { formatLastChecked, isCatalogStale } from '../lib/freshness';

interface CasinoCardProps {
  casino: Casino;
  index: number;
  onEdit?: (casino: Casino) => void;
  onBlock?: (casino: Casino) => void;
  admin?: boolean;
  favorited?: boolean;
  onToggleFavorite?: () => void;
}

export default function CasinoCard({
  casino, index, onEdit, onBlock, admin, favorited, onToggleFavorite,
}: CasinoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      className="glass p-5 group card-shine hover:border-glow/25 transition-all duration-300 border-gradient"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/casinos/${casino.urlNormalized ?? casino.id}`} className="font-display font-semibold text-lg hover:text-glow transition-colors">
            {casino.name}
          </Link>
          {casino.verified && (
            <ShieldCheck className="w-4 h-4 text-accent-green" aria-label="Verified" />
          )}
          {casino.reviewStatus === 'pending' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Pending
            </span>
          )}
          {admin && casino.healthStatus === 'failed' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
              Failed
            </span>
          )}
          {admin && isCatalogStale(casino.lastCheckedAt) && casino.reviewStatus === 'approved' && casino.healthStatus !== 'failed' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 border border-orange-500/25" title="Homepage not re-checked recently">
              Stale
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-accent-gold">
          <Star className="w-4 h-4 fill-current" />
          <span className="text-sm font-medium">{casino.rating.toFixed(1)}</span>
        </div>
      </div>

      {admin && (
        <p className={`text-[10px] mb-2 ${isCatalogStale(casino.lastCheckedAt) ? 'text-orange-400/80' : 'text-gray-600'}`}>
          {formatLastChecked(casino.lastCheckedAt)}
        </p>
      )}

      <p className="text-sm text-gray-400 mb-2 line-clamp-2">
        {casino.description || 'No description'}
      </p>

      <p className="text-xs mb-3">
        <span className={
          casino.features.includes('vpn_blocked')
            ? 'text-rose-400'
            : casino.features.includes('vpn_allowed')
              ? 'text-emerald-400'
              : 'text-gray-500'
        }>
          🛡️ {vpnLabel(casino.features)}
          {casino.features.includes('geo_restricted') && ' • 🌍 Geo Restricted'}
        </span>
      </p>

      {(casino.cashOutBeforeBlocked != null || casino.trackables?.length > 0) && (
        <div className="mb-3 p-2.5 rounded-lg bg-surface-overlay border border-surface-border space-y-1">
          {casino.cashOutBeforeBlocked != null && (
            <p className="text-xs text-accent-gold">
              💰 Cash Out Before Blocked: {formatTrackableValue(casino.cashOutBeforeBlocked)}
            </p>
          )}
          {casino.trackables?.map((t, i) => (
            <p key={`${t.label}-${i}`} className="text-xs text-gray-400">
              📊 {t.label}: {formatTrackableValue(t.value)}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {casino.features.slice(0, 8).map((f) => (
          <span
            key={f}
            className={`text-xs px-2 py-0.5 rounded-full ${FEATURE_COLORS[f]}`}
          >
            {FEATURE_LABELS[f]}
          </span>
        ))}
        {casino.features.length > 8 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a22] text-gray-500 border border-[#2a2a35]">
            +{casino.features.length - 8} more
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <a
          href={casino.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-sm flex items-center gap-1.5 flex-1 justify-center"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Visit
        </a>
        {admin && onEdit && (
          <button onClick={() => onEdit(casino)} className="btn-secondary text-sm">
            Edit
          </button>
        )}
        {admin && onBlock && (
          <button
            onClick={() => onBlock(casino)}
            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Block as scam"
          >
            <Ban className="w-4 h-4" />
          </button>
        )}
        {onToggleFavorite != null && (
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`p-2 rounded-lg border transition-colors ${
              favorited
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                : 'border-transparent text-gray-500 hover:text-rose-400'
            }`}
            title={favorited ? 'Remove from My List' : 'Save to My List'}
          >
            <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
          </button>
        )}
        <Link
          to={`/similar?casino=${casino.id}`}
          className="p-2 rounded-lg text-gray-500 hover:text-[#00aeef] hover:bg-[#00aeef]/10 transition-colors"
          title="Find similar casinos"
        >
          <Sparkles className="w-4 h-4" />
        </Link>
      </div>
    </motion.div>
  );
}
