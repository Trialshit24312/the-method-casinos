import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, Star, ExternalLink, Share2, Search } from 'lucide-react';
import { api } from '../api';
import type { Casino, CasinoCompareResult } from '../types';
import { FEATURE_LABELS, FEATURE_COLORS } from '../types';
import PageHeader from '../components/PageHeader';
import { usePageTitle } from '../hooks/usePageTitle';

function CasinoPick({
  label,
  casinos,
  value,
  onChange,
  filter,
  onFilterChange,
}: {
  label: string;
  casinos: Casino[];
  value: string;
  onChange: (id: string) => void;
  filter: string;
  onFilterChange: (q: string) => void;
}) {
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return casinos;
    return casinos.filter((c) => c.name.toLowerCase().includes(q));
  }, [casinos, filter]);

  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-gray-500 mb-2 block">{label}</label>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
        <input
          className="input-field pl-9 text-sm"
          placeholder="Filter list…"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        />
      </div>
      <select className="input-field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select casino…</option>
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>{c.name} ({c.rating.toFixed(1)}★)</option>
        ))}
      </select>
    </div>
  );
}

export default function ComparePage() {
  usePageTitle('Compare Casinos — The Method');
  const [searchParams, setSearchParams] = useSearchParams();
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [a, setA] = useState(searchParams.get('a') ?? '');
  const [b, setB] = useState(searchParams.get('b') ?? '');
  const [filterA, setFilterA] = useState('');
  const [filterB, setFilterB] = useState('');
  const [result, setResult] = useState<CasinoCompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shareMsg, setShareMsg] = useState('');

  useEffect(() => {
    api.getCasinos().then(setCasinos).catch(console.error);
  }, []);

  useEffect(() => {
    const qa = searchParams.get('a');
    const qb = searchParams.get('b');
    if (qa) setA(qa);
    if (qb) setB(qb);
  }, [searchParams]);

  useEffect(() => {
    if (a && b && a !== b) {
      setSearchParams({ a, b }, { replace: true });
    } else if (a && !b) {
      setSearchParams({ a }, { replace: true });
    } else if (!a && !b) {
      setSearchParams({}, { replace: true });
    }
  }, [a, b, setSearchParams]);

  useEffect(() => {
    if (!a || !b || a === b) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError('');
    api.compareCasinos(a, b)
      .then(setResult)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Compare failed');
        setResult(null);
      })
      .finally(() => setLoading(false));
  }, [a, b]);

  const share = () => {
    if (!a || !b) return;
    const url = `${window.location.origin}${window.location.pathname}?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`;
    void navigator.clipboard.writeText(url);
    setShareMsg('Link copied — share this comparison');
    setTimeout(() => setShareMsg(''), 3000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        icon={<Scale className="w-6 h-6 text-[#00aeef]" />}
        title="Compare Casinos"
        subtitle="Pick two operators — shareable link syncs to the URL. Same logic as Discord /compare."
        action={
          a && b && a !== b ? (
            <button type="button" onClick={share} className="btn-secondary text-sm flex items-center gap-1.5">
              <Share2 className="w-4 h-4" /> Share
            </button>
          ) : undefined
        }
      />

      {shareMsg && <p className="text-emerald-400 text-sm mb-4">{shareMsg}</p>}

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <CasinoPick label="Casino A" casinos={casinos} value={a} onChange={setA} filter={filterA} onFilterChange={setFilterA} />
        <CasinoPick label="Casino B" casinos={casinos} value={b} onChange={setB} filter={filterB} onFilterChange={setFilterB} />
      </div>

      {a && b && a === b && (
        <p className="text-amber-400 text-sm mb-4">Pick two different casinos.</p>
      )}

      {loading && <p className="text-gray-500">Comparing…</p>}
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {result && !loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-glow p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {[result.a, result.b].map((casino) => (
              <div key={casino.id}>
                <h3 className="font-display font-semibold text-lg text-white mb-1">
                  <Link to={`/casinos/${casino.urlNormalized ?? casino.id}`} className="hover:text-glow">
                    {casino.name}
                  </Link>
                </h3>
                <p className="text-sm text-amber-400 flex items-center gap-1 mb-2">
                  <Star className="w-4 h-4 fill-current" /> {casino.rating.toFixed(1)}
                </p>
                <a href={casino.url} target="_blank" rel="noreferrer" className="text-sm text-glow hover:underline flex items-center gap-1">
                  Visit <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>

          {result.sharedFeatures.length > 0 && (
            <div>
              <p className="text-xs uppercase text-gray-500 mb-2">Shared features</p>
              <div className="flex flex-wrap gap-2">
                {result.sharedFeatures.map((f) => (
                  <span key={f} className={`text-xs px-2 py-1 rounded-full border ${FEATURE_COLORS[f] ?? 'bg-white/5 text-gray-400'}`}>
                    {FEATURE_LABELS[f] ?? f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(result.onlyA.length > 0 || result.onlyB.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              {result.onlyA.length > 0 && (
                <div>
                  <p className="text-xs uppercase text-gray-500 mb-2">Only {result.a.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.onlyA.map((f) => (
                      <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400">
                        {FEATURE_LABELS[f] ?? f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.onlyB.length > 0 && (
                <div>
                  <p className="text-xs uppercase text-gray-500 mb-2">Only {result.b.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.onlyB.map((f) => (
                      <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400">
                        {FEATURE_LABELS[f] ?? f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-gray-600">Rating gap: {result.ratingDiff.toFixed(1)} stars</p>
        </motion.div>
      )}
    </div>
  );
}
