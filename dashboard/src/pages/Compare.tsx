import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, Star, ExternalLink } from 'lucide-react';
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
}: {
  label: string;
  casinos: Casino[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-gray-500 mb-2 block">{label}</label>
      <select className="input-field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select casino…</option>
        {casinos.map((c) => (
          <option key={c.id} value={c.id}>{c.name} ({c.rating.toFixed(1)}★)</option>
        ))}
      </select>
    </div>
  );
}

export default function ComparePage() {
  usePageTitle('Compare Casinos — The Method');
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [result, setResult] = useState<CasinoCompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getCasinos().then(setCasinos).catch(console.error);
  }, []);

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
        setError(e.message);
        setResult(null);
      })
      .finally(() => setLoading(false));
  }, [a, b]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        icon={<Scale className="w-6 h-6 text-[#00aeef]" />}
        title="Compare Casinos"
        subtitle="Pick two operators — see shared features, signup style, and rating side-by-side. Same logic as Discord /compare."
      />

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <CasinoPick label="Casino A" casinos={casinos} value={a} onChange={setA} />
        <CasinoPick label="Casino B" casinos={casinos} value={b} onChange={setB} />
      </div>

      {a && b && a === b && (
        <p className="text-amber-400 text-sm mb-4">Pick two different casinos.</p>
      )}

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-glow border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {result && !loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            {[result.a, result.b].map((c) => (
              <div key={c.id} className="glass-glow p-5 card-shine">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-display font-bold text-lg">{c.name}</h3>
                  <span className="flex items-center gap-1 text-brand-light text-sm">
                    <Star className="w-4 h-4 fill-current" /> {c.rating.toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">{c.signupRequirements.join(' + ') || 'Email signup'}</p>
                <a href={c.url} target="_blank" rel="noreferrer" className="btn-primary text-sm inline-flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" /> Visit
                </a>
              </div>
            ))}
          </div>

          <div className="glass-glow p-5">
            <h4 className="font-semibold text-white mb-3">Shared features ({result.sharedFeatures.length})</h4>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {result.sharedFeatures.map((f) => (
                <span key={f} className={`text-xs px-2 py-0.5 rounded-full ${FEATURE_COLORS[f]}`}>{FEATURE_LABELS[f]}</span>
              ))}
              {!result.sharedFeatures.length && <span className="text-gray-500 text-sm">None</span>}
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Only {result.a.name}</p>
                <p className="text-gray-300">{result.onlyA.map((f) => FEATURE_LABELS[f]).join(', ') || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Only {result.b.name}</p>
                <p className="text-gray-300">{result.onlyB.map((f) => FEATURE_LABELS[f]).join(', ') || '—'}</p>
              </div>
            </div>
          </div>

          <Link to={`/similar?casino=${result.a.id}`} className="text-glow text-sm hover:underline">
            Find casinos like {result.a.name} →
          </Link>
        </motion.div>
      )}
    </div>
  );
}
