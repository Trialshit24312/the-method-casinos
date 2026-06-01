import { RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import type { Casino } from '../types';
import { formatLastChecked, isCatalogStale } from '../lib/freshness';

interface Props {
  casino: Casino;
  onRecheck: () => void;
  onUnlist: () => void;
  busy?: boolean;
}

export default function CatalogHealthRow({ casino, onRecheck, onUnlist, busy }: Props) {
  const failed = casino.healthStatus === 'failed';
  const stale = isCatalogStale(casino.lastCheckedAt);

  return (
    <div className={`glass p-4 flex flex-wrap items-start justify-between gap-3 ${failed ? 'border-red-500/25' : 'border-orange-500/20'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-medium text-white">{casino.name}</h3>
          {failed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
              Failed check
            </span>
          )}
          {!failed && stale && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 border border-orange-500/25">
              Stale
            </span>
          )}
        </div>
        <a href={casino.url} target="_blank" rel="noopener noreferrer" className="text-xs text-glow hover:underline flex items-center gap-1">
          {casino.url.replace(/^https?:\/\//, '')}
          <ExternalLink className="w-3 h-3" />
        </a>
        <p className="text-xs text-gray-500 mt-1">{formatLastChecked(casino.lastCheckedAt)}</p>
        {casino.healthNote && (
          <p className="text-xs text-red-300/80 mt-1">{casino.healthNote}</p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          disabled={busy}
          onClick={onRecheck}
          className="btn-secondary text-xs flex items-center gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          Re-check
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onUnlist}
          className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Unlist
        </button>
      </div>
    </div>
  );
}
