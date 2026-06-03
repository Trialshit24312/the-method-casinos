import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Search, Star, ExternalLink, ChevronRight, Dices, Globe, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import { api } from '../api';
import type { Casino, SimilarCasinoMatch, SimilarWebDiscoveryResult } from '../types';
import { FEATURE_LABELS, FEATURE_COLORS } from '../types';
import PageHeader from '../components/PageHeader';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../context/AuthContext';

function MatchCard({ match, index }: { match: SimilarCasinoMatch; index: number }) {
  const pct = match.matchPercent;
  const ringColor = pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-glow' : 'text-brand-light';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass-glow p-5 border-glow/15 hover:border-glow/35 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-display font-semibold text-lg text-white">{match.casino.name}</h3>
          <div className="flex items-center gap-1 text-brand-light text-sm mt-0.5">
            <Star className="w-3.5 h-3.5 fill-current" />
            {match.casino.rating.toFixed(1)}
          </div>
        </div>
        <div className={`text-right shrink-0 ${ringColor}`}>
          <p className="text-2xl font-bold font-display">{pct}%</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-600">match</p>
        </div>
      </div>

      <p className="text-sm text-gray-500 line-clamp-2 mb-3">{match.casino.description || 'No description'}</p>

      {match.reasons.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {match.reasons.map((r) => (
            <span key={r} className="text-[10px] px-2 py-0.5 rounded-full bg-glow/10 text-glow border border-glow/25">
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 mb-4">
        {match.sharedFeatures.slice(0, 6).map((f) => (
          <span key={f} className={`text-[10px] px-1.5 py-0.5 rounded-full ${FEATURE_COLORS[f]}`}>
            {FEATURE_LABELS[f]}
          </span>
        ))}
        {match.sharedFeatures.length > 6 && (
          <span className="text-[10px] text-gray-600">+{match.sharedFeatures.length - 6}</span>
        )}
      </div>

      <div className="flex gap-2">
        <a href={match.casino.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm flex-1 flex items-center justify-center gap-1.5">
          <ExternalLink className="w-3.5 h-3.5" /> Visit
        </a>
        <Link
          to={`/similar?casino=${match.casino.id}`}
          className="btn-secondary text-sm flex items-center gap-1 px-3"
          title="Find casinos like this one"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}

function CandidateRow({ c }: { c: SimilarWebDiscoveryResult['candidates'][0] }) {
  const Icon = c.status === 'added' ? CheckCircle : c.status === 'rejected' ? XCircle : MinusCircle;
  const tone = c.status === 'added' ? 'text-emerald-400' : c.status === 'rejected' ? 'text-amber-400' : 'text-gray-500';
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm border-b border-surface-border last:border-0">
      <Icon className={`w-4 h-4 shrink-0 ${tone}`} />
      <div className="min-w-0 flex-1">
        <p className="text-white truncate">{c.name}</p>
        <p className="text-xs text-gray-600 truncate">{c.url.replace(/^https:\/\//, '')}</p>
      </div>
      <span className={`text-xs shrink-0 ${tone}`}>
        {c.status === 'added' ? 'Queued' : c.reason ?? c.status}
      </span>
    </div>
  );
}

export default function SimilarCasinosPage() {
  usePageTitle('Similar Casinos — The Method');
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allCasinos, setAllCasinos] = useState<Casino[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Casino | null>(null);
  const [matches, setMatches] = useState<SimilarCasinoMatch[]>([]);
  const [webResult, setWebResult] = useState<SimilarWebDiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [webLoading, setWebLoading] = useState(false);
  const [error, setError] = useState('');

  const runSimilar = useCallback(async (casinoId: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.getSimilar({ casinoId, limit: 12 });
      setSelected(result.source);
      setQuery(result.source.name);
      setMatches(result.matches);
      setWebResult(null);
      setSearchParams({ casino: casinoId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to find similar casinos');
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [setSearchParams]);

  useEffect(() => {
    api.getCasinos().then(setAllCasinos).catch(console.error);
  }, []);

  useEffect(() => {
    const id = searchParams.get('casino');
    if (id) runSimilar(id);
  }, [searchParams, runSimilar]);

  const filtered = query.trim()
    ? allCasinos.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : allCasinos.slice(0, 8);

  const pickCasino = (casino: Casino) => {
    setQuery(casino.name);
    runSimilar(casino.id);
  };

  const searchWeb = async () => {
    if (!selected) return;
    setWebLoading(true);
    setError('');
    try {
      const result = await api.discoverSimilarWeb(selected.id);
      setWebResult(result);
      if (result.catalogMatches.length) {
        setMatches(result.catalogMatches);
      }
      if (result.added > 0) {
        api.getCasinos().then(setAllCasinos).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Web search failed');
    } finally {
      setWebLoading(false);
    }
  };

  const showPicker = query.trim() && filtered.length > 0 && (!selected || !filtered.some((c) => c.id === selected.id));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        icon={<Sparkles className="w-6 h-6 text-glow" />}
        title="Similar Casinos"
        subtitle="Pick a casino — match from catalog, or search the web from your browser (no API keys) for more operators like it"
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-glow p-6 mb-8 border-glow/20">
        <label className="text-xs uppercase tracking-wide text-gray-500 mb-2 block">Find casinos like...</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            className="input-field pl-10"
            placeholder="Search by name — e.g. Chumba, Pulsz, McLuck..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {showPicker && (
          <div className="mt-2 rounded-xl border border-surface-border overflow-hidden">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => pickCasino(c)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-glow/5 border-b border-surface-border last:border-0"
              >
                <span className="text-white font-medium">{c.name}</span>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            ))}
          </div>
        )}

        {!query && (
          <div className="mt-4">
            <p className="text-xs text-gray-600 mb-2">Popular picks</p>
            <div className="flex flex-wrap gap-2">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pickCasino(c)}
                  className="text-sm px-3 py-1.5 rounded-full border border-surface-border bg-surface-muted
                             hover:border-glow/40 hover:text-glow text-gray-400 transition-colors"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-glow border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {selected && !loading && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 p-4 rounded-xl bg-[#b87333]/10 border border-[#b87333]/25 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-400">
              Showing casinos similar to{' '}
              <span className="text-white font-semibold">{selected.name}</span>
              {' '}— {matches.length} catalog match{matches.length === 1 ? '' : 'es'}
            </p>
            {user ? (
              <button
                type="button"
                onClick={() => void searchWeb()}
                disabled={webLoading}
                className="btn-primary text-sm flex items-center gap-2 shrink-0"
              >
                <Globe className={`w-4 h-4 ${webLoading ? 'animate-spin' : ''}`} />
                {webLoading ? 'Searching from your browser…' : 'Search web from browser'}
              </button>
            ) : (
              <Link
                to={`/login?next=${encodeURIComponent(`/similar?casino=${selected.id}`)}`}
                className="btn-glow text-sm shrink-0"
              >
                Sign in to search the web
              </Link>
            )}
          </motion.div>

          {webResult && (
            <div className="mb-6 space-y-3">
              <div className="p-4 rounded-lg border border-glow/25 bg-glow/5 text-sm text-gray-300">
                <p>
                  {webResult.searchMode === 'browser' ? 'Browser' : webResult.searchMode === 'mixed' ? 'Browser + server' : 'Web'} search
                  ({webResult.queries.length} queries): {webResult.webUrlsFound} URLs · {webResult.analyzed} analyzed ·{' '}
                  <span className="text-emerald-400">{webResult.added} in Review Queue</span>
                  {webResult.rejected > 0 && ` · ${webResult.rejected} skipped/rejected`}
                </p>
                {webResult.added > 0 && (
                  <p className="text-xs text-gray-500 mt-1">New finds go to Review Queue before appearing in the catalog.</p>
                )}
              </div>
              {webResult.candidates.length > 0 && (
                <div className="rounded-xl border border-surface-border overflow-hidden">
                  <p className="text-xs uppercase tracking-wide text-gray-600 px-3 py-2 bg-surface-muted">Web search results</p>
                  {webResult.candidates.map((c) => (
                    <CandidateRow key={`${c.url}-${c.status}`} c={c} />
                  ))}
                </div>
              )}
            </div>
          )}

          {matches.length === 0 ? (
            <div className="glass p-12 text-center">
              <Dices className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">No close catalog matches yet. Try <strong className="text-gray-400">Search web for more</strong> to find new operators.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {matches.map((m, i) => (
                <MatchCard key={m.casino.id} match={m} index={i} />
              ))}
            </div>
          )}
        </>
      )}

      {!selected && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-8 text-center">
          <Sparkles className="w-10 h-10 text-glow/50 mx-auto mb-4" />
          <p className="text-gray-500">Select a casino above — we match from the verified catalog, or search DuckDuckGo, Bing & Brave for new operators like it. 100% free, no API keys.</p>
        </motion.div>
      )}
    </div>
  );
}
