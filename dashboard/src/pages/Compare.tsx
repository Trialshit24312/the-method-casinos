import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, Star, ExternalLink, Share2, ArrowLeftRight } from 'lucide-react';
import { api } from '../api';
import type { Casino, CasinoCompareResult } from '../types';
import { FEATURE_LABELS, FEATURE_COLORS } from '../types';
import PageHeader from '../components/PageHeader';
import CasinoCombobox from '../components/CasinoCombobox';
import EmptyState from '../components/EmptyState';
import Breadcrumb from '../components/Breadcrumb';
import ErrorBanner from '../components/ErrorBanner';
import NoticeBanner from '../components/NoticeBanner';
import CompareSkeleton from '../components/CompareSkeleton';
import { useTimedNotice } from '../hooks/useTimedNotice';
import { usePageTitle } from '../hooks/usePageTitle';

export default function ComparePage() {
  usePageTitle('Compare Casinos — The Method');
  const [searchParams, setSearchParams] = useSearchParams();
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [a, setA] = useState(searchParams.get('a') ?? '');
  const [b, setB] = useState(searchParams.get('b') ?? '');
  const [result, setResult] = useState<CasinoCompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { message: shareMsg, show: showShareMsg } = useTimedNotice(3000);

  const loadCatalog = () => {
    setCatalogError('');
    api.getCasinos()
      .then(setCasinos)
      .catch(() => setCatalogError('Could not load casino catalog for comparison.'));
  };

  useEffect(() => {
    loadCatalog();
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
    showShareMsg('Link copied — share this comparison');
  };

  const swap = () => {
    if (!a || !b) return;
    setA(b);
    setB(a);
  };

  return (
    <div className="page-container-catalog">
      <Breadcrumb items={[{ label: 'Catalog', to: '/casinos' }, { label: 'Compare' }]} />
      <PageHeader
        icon={<Scale className="w-6 h-6 text-glow" />}
        title="Compare Casinos"
        subtitle="Pick two operators — shareable link syncs to the URL. Same logic as Discord /compare."
        action={
          a && b && a !== b ? (
            <div className="flex gap-2">
              <button type="button" onClick={swap} className="btn-secondary text-sm flex items-center gap-1.5" title="Swap A and B">
                <ArrowLeftRight className="w-4 h-4" /> Swap
              </button>
              <button type="button" onClick={share} className="btn-glow text-sm flex items-center gap-1.5">
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          ) : undefined
        }
      />

      {shareMsg && <NoticeBanner message={shareMsg} variant="success" />}
      {catalogError && <ErrorBanner message={catalogError} onRetry={loadCatalog} variant="warning" />}

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <CasinoCombobox label="Casino A" casinos={casinos} value={a} onChange={setA} />
        <CasinoCombobox label="Casino B" casinos={casinos} value={b} onChange={setB} />
      </div>

      {a && b && a === b && (
        <p className="text-amber-400 text-sm mb-4">Pick two different casinos.</p>
      )}

      {loading && <CompareSkeleton />}
      {error && <ErrorBanner message={error} variant="warning" />}

      {!loading && !result && !a && !b && (
        <EmptyState
          icon={Scale}
          title="Select two casinos"
          description="Search by name above — or open a casino profile and use Compare this casino."
          action={<Link to="/casinos" className="btn-glow text-sm">Browse catalog</Link>}
        />
      )}

      {result && !loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-glow p-6 space-y-6 border-glow/15">
          <div className="grid md:grid-cols-2 gap-6">
            {[result.a, result.b].map((casino) => (
              <div key={casino.id} className="p-4 rounded-xl bg-surface-muted/50 border border-surface-border">
                <h3 className="font-display font-semibold text-lg text-white mb-1">
                  <Link to={`/casinos/${casino.urlNormalized ?? casino.id}`} className="hover:text-glow transition-colors">
                    {casino.name}
                  </Link>
                </h3>
                <p className="text-sm text-brand-light flex items-center gap-1 mb-2">
                  <Star className="w-4 h-4 fill-current" /> {casino.rating.toFixed(1)}
                </p>
                <a href={casino.url} target="_blank" rel="noreferrer" className="text-sm text-glow hover:underline flex items-center gap-1">
                  Visit <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>{result.a.name}</span>
              <span>Rating gap: {result.ratingDiff.toFixed(1)}★</span>
              <span>{result.b.name}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-muted overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-brand to-brand-light transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(20, 50 + (result.a.rating - result.b.rating) * 10))}%`,
                }}
              />
              <div className="flex-1 h-full bg-gradient-to-r from-glow/40 to-glow" />
            </div>
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
                <div className="p-4 rounded-xl border border-brand/20 bg-brand/5">
                  <p className="text-xs uppercase text-brand-light mb-2">Only {result.a.name}</p>
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
                <div className="p-4 rounded-xl border border-glow/20 bg-glow/5">
                  <p className="text-xs uppercase text-glow mb-2">Only {result.b.name}</p>
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

          <div className="flex flex-wrap gap-3 text-sm pt-2 border-t border-surface-border">
            <Link to={`/similar?casino=${result.a.id}`} className="text-glow hover:underline">Similar to {result.a.name} →</Link>
            <Link to={`/tools/checker?url=${encodeURIComponent(result.a.url)}`} className="text-gray-500 hover:text-glow">Check A URL</Link>
            <Link to={`/tools/checker?url=${encodeURIComponent(result.b.url)}`} className="text-gray-500 hover:text-glow">Check B URL</Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
