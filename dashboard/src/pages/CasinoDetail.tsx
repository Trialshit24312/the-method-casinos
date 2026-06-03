import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ExternalLink, Star, ShieldCheck, Sparkles, Heart, Share2, AlertTriangle, Clock, Flag, Link2, ClipboardList,
} from 'lucide-react';
import ReportSiteModal from '../components/ReportSiteModal';
import { api } from '../api';
import type { Casino, SimilarCasinosResult } from '../types';
import PageHeader from '../components/PageHeader';
import CasinoCarousel from '../components/CasinoCarousel';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { pushRecentlyViewed } from '../lib/recently-viewed';
import Breadcrumb from '../components/Breadcrumb';
import { FEATURE_LABELS, FEATURE_COLORS, vpnLabel, formatTrackableValue } from '../types';
import { formatLastChecked, isCatalogStale } from '../lib/freshness';

export default function CasinoDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [casino, setCasino] = useState<Casino | null>(null);
  const [similar, setSimilar] = useState<SimilarCasinosResult | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');

  usePageTitle(casino ? `${casino.name} — The Method Casinos` : 'Casino — The Method Casinos');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    Promise.all([
      api.getCasino(slug),
      user ? api.getFavorites().catch(() => []) : Promise.resolve([]),
    ])
      .then(async ([c, favs]) => {
        setCasino(c);
        setFavorited(favs.some((f) => f.casino.id === c.id));
        pushRecentlyViewed(c);
        window.dispatchEvent(new Event('method-recent-view'));
        const sim = await api.getSimilar({ casinoId: c.id, limit: 6 }).catch(() => null);
        setSimilar(sim);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, user]);

  const toggleFavorite = async () => {
    if (!user || !casino) return;
    if (favorited) {
      await api.removeFavorite(casino.id);
      setFavorited(false);
    } else {
      await api.addFavorite(casino.id);
      setFavorited(true);
    }
  };

  const profileUrl = () =>
    `${window.location.origin}/casinos/${casino?.urlNormalized ?? casino?.id ?? slug}`;

  const share = async () => {
    const url = profileUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: casino?.name, url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopyMsg('Profile link copied');
    setTimeout(() => setCopyMsg(''), 2500);
  };

  const copySiteUrl = async () => {
    if (!casino) return;
    await navigator.clipboard.writeText(casino.url);
    setCopyMsg('Casino URL copied');
    setTimeout(() => setCopyMsg(''), 2500);
  };

  const copySignupKit = async () => {
    if (!casino) return;
    const checker = `${window.location.origin}/tools/checker?url=${encodeURIComponent(casino.url)}`;
    const emailTools = `${window.location.origin}/tools/email`;
    const lines = [
      `🎰 ${casino.name}`,
      casino.url,
      '',
      casino.signupRequirements.length ? 'Signup requirements:' : '',
      ...casino.signupRequirements.map((req) => `• ${req}`),
      casino.bonusInfo ? `\nBonus: ${casino.bonusInfo}` : '',
      '',
      `URL safety check: ${checker}`,
      `Temp email tools: ${emailTools}`,
    ].filter((line) => line !== '').join('\n');
    await navigator.clipboard.writeText(lines);
    setCopyMsg('Signup kit copied to clipboard');
    setTimeout(() => setCopyMsg(''), 2500);
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="h-4 w-48 bg-white/5 rounded animate-pulse mb-6" />
        <div className="glass-glow p-8 animate-pulse space-y-4">
          <div className="h-8 w-2/3 bg-white/10 rounded" />
          <div className="h-4 w-full bg-white/5 rounded" />
          <div className="h-4 w-5/6 bg-white/5 rounded" />
          <div className="flex gap-2 pt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-24 bg-white/5 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !casino) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <p className="text-red-400 mb-4">{error || 'Casino not found'}</p>
        <Link to="/casinos" className="text-glow hover:underline">← Back to catalog</Link>
      </div>
    );
  }

  if (casino.reviewStatus === 'pending' && !user?.isAdmin) {
    return <Navigate to="/casinos" replace />;
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <Breadcrumb
        items={[
          { label: 'Catalog', to: '/casinos' },
          { label: casino.name },
        ]}
      />
      <PageHeader
        title={casino.name}
        subtitle={casino.url.replace(/^https?:\/\//, '')}
        icon={<ShieldCheck className="w-6 h-6 text-emerald-400" />}
      />

      {casino.healthStatus === 'failed' && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Health check failed: {casino.healthNote || 'Site may be offline or changed.'}</span>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-glow p-6 mb-8 border-glow/15">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-accent-gold">
              <Star className="w-5 h-5 fill-current" />
              <span className="text-lg font-semibold">{casino.rating.toFixed(1)}</span>
            </div>
            {casino.verified && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Verified
              </span>
            )}
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatLastChecked(casino.lastCheckedAt)}
              {isCatalogStale(casino.lastCheckedAt) && user?.isAdmin && (
                <span className="text-orange-400 ml-1">(stale)</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {user ? (
              <button
                type="button"
                onClick={() => void toggleFavorite()}
                className={`p-2 rounded-lg border transition-colors ${
                  favorited
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                    : 'border-surface-border text-gray-500 hover:text-rose-400'
                }`}
                title={favorited ? 'Remove from My List' : 'Save to My List'}
              >
                <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
              </button>
            ) : (
              <Link
                to={`/login?next=${encodeURIComponent(window.location.pathname)}`}
                className="p-2 rounded-lg border border-surface-border text-gray-500 hover:text-rose-400 transition-colors"
                title="Sign in to save to My List"
              >
                <Heart className="w-4 h-4" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => void copySignupKit()}
              className="btn-glow text-sm flex items-center gap-1.5"
              title="Copy signup checklist with tools links"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Signup kit
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="btn-secondary text-sm flex items-center gap-1.5 text-amber-400/90"
            >
              <Flag className="w-3.5 h-3.5" /> Report
            </button>
            <button type="button" onClick={() => void copySiteUrl()} className="btn-secondary text-sm flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> Copy URL
            </button>
            <button type="button" onClick={() => void share()} className="btn-secondary text-sm flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
            <a href={casino.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Visit Site
            </a>
          </div>
        </div>

        {copyMsg && <p className="text-emerald-400 text-sm mb-2">{copyMsg}</p>}

        <p className="text-gray-300 mb-4">{casino.description || 'No description available.'}</p>

        <p className="text-sm mb-4">
          <span className={
            casino.features.includes('vpn_blocked')
              ? 'text-rose-400'
              : casino.features.includes('vpn_allowed')
                ? 'text-emerald-400'
                : 'text-gray-500'
          }>
            🛡️ {vpnLabel(casino.features)}
          </span>
        </p>

        {casino.bonusInfo && (
          <p className="text-sm text-accent-gold mb-4">🎁 {casino.bonusInfo}</p>
        )}

        {(casino.cashOutBeforeBlocked != null || casino.trackables?.length > 0) && (
          <div className="mb-4 p-3 rounded-lg bg-surface-overlay border border-surface-border space-y-1">
            {casino.cashOutBeforeBlocked != null && (
              <p className="text-sm text-accent-gold">
                💰 Cash Out Before Blocked: {formatTrackableValue(casino.cashOutBeforeBlocked)}
              </p>
            )}
            {casino.trackables?.map((t, i) => (
              <p key={`${t.label}-${i}`} className="text-sm text-gray-400">
                📊 {t.label}: {formatTrackableValue(t.value)}
              </p>
            ))}
          </div>
        )}

        {casino.signupRequirements.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Signup requirements</h3>
            <ul className="text-sm text-gray-300 list-disc list-inside">
              {casino.signupRequirements.map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {casino.features.map((f) => (
            <span key={f} className={`text-xs px-2 py-0.5 rounded-full ${FEATURE_COLORS[f]}`}>
              {FEATURE_LABELS[f]}
            </span>
          ))}
        </div>
      </motion.div>

      {similar && similar.matches.length > 0 && (
        <CasinoCarousel
          title="Similar Casinos"
          subtitle="Based on shared features and signup profile"
          casinos={similar.matches.map((m) => m.casino)}
          icon={<Sparkles className="w-5 h-5 text-glow" />}
          action={
            <Link to={`/similar?casino=${casino.id}`} className="text-sm text-glow hover:underline">
              View all →
            </Link>
          }
        />
      )}

      <div className="flex flex-wrap gap-4 mt-8 text-sm">
        <Link to="/casinos" className="text-gray-500 hover:text-white">← Back to catalog</Link>
        <Link to={`/compare?a=${casino.id}`} className="text-glow hover:underline">Compare this casino →</Link>
        <Link to={`/tools/checker?url=${encodeURIComponent(casino.url)}`} className="text-glow hover:underline">Check URL safety →</Link>
      </div>

      <ReportSiteModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        initialUrl={casino.url}
      />
    </div>
  );
}
