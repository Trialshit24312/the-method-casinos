import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ExternalLink, Star, ShieldCheck, Sparkles, Heart, Share2, AlertTriangle, Clock, Flag, Link2, ClipboardList, Scale, Shuffle, Dices,
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
import EmptyState from '../components/EmptyState';
import NoticeBanner from '../components/NoticeBanner';
import { useTimedNotice } from '../hooks/useTimedNotice';
import ErrorBanner from '../components/ErrorBanner';
import CasinoDetailSkeleton from '../components/CasinoDetailSkeleton';
import QuickLinkRow from '../components/QuickLinkRow';
import RecentlyViewed from '../components/RecentlyViewed';
import { FEATURE_LABELS, FEATURE_COLORS, vpnLabel, formatTrackableValue } from '../types';
import { formatLastChecked, isCatalogStale } from '../lib/freshness';
import { isGuestFavorite, toggleGuestFavorite } from '../lib/guest-favorites';
import { copyToClipboard } from '../lib/copy-to-clipboard';

export default function CasinoDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [casino, setCasino] = useState<Casino | null>(null);
  const [similar, setSimilar] = useState<SimilarCasinosResult | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const { message: copyMsg, show: showCopyMsg } = useTimedNotice();
  const { message: favMsg, show: showFavMsg } = useTimedNotice();

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
        setFavorited(user ? favs.some((f) => f.casino.id === c.id) : isGuestFavorite(c.id));
        pushRecentlyViewed(c);
        window.dispatchEvent(new Event('method-recent-view'));
        const sim = await api.getSimilar({ casinoId: c.id, limit: 6 }).catch(() => null);
        setSimilar(sim);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load casino'))
      .finally(() => setLoading(false));
  }, [slug, user]);

  const toggleFavorite = async () => {
    if (!casino) return;
    if (!user) {
      const added = toggleGuestFavorite(casino);
      setFavorited(added);
      showFavMsg(added ? 'Added to My List (local)' : 'Removed from My List');
      return;
    }
    try {
      if (favorited) {
        await api.removeFavorite(casino.id);
        setFavorited(false);
        showFavMsg('Removed from My List');
      } else {
        await api.addFavorite(casino.id);
        setFavorited(true);
        showFavMsg('Added to My List');
      }
    } catch {
      showFavMsg('Could not update My List — try again');
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
    const ok = await copyToClipboard(url);
    showCopyMsg(ok ? 'Profile link copied' : 'Could not copy link');
  };

  const copySiteUrl = async () => {
    if (!casino) return;
    const ok = await copyToClipboard(casino.url);
    showCopyMsg(ok ? 'Casino URL copied' : 'Could not copy URL');
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
    const ok = await copyToClipboard(lines);
    showCopyMsg(ok ? 'Signup kit copied to clipboard' : 'Could not copy signup kit');
  };

  if (loading) {
    return <CasinoDetailSkeleton />;
  }

  if (error || !casino) {
    return (
      <div className="page-container-narrow">
        <Breadcrumb items={[{ label: 'Catalog', to: '/casinos' }, { label: 'Not found' }]} />
        <ErrorBanner
          message={error || 'Casino not found'}
          onRetry={slug ? () => {
            setError('');
            setLoading(true);
            api.getCasino(slug)
              .then(setCasino)
              .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
              .finally(() => setLoading(false));
          } : undefined}
        />
        <EmptyState
          icon={ShieldCheck}
          title="Operator unavailable"
          description="This operator may have been removed or the link is incorrect."
          action={<Link to="/casinos" className="btn-secondary text-sm">Back to catalog</Link>}
        />
      </div>
    );
  }

  if (casino.reviewStatus === 'pending' && !user?.isAdmin) {
    return <Navigate to="/casinos" replace />;
  }

  return (
    <div className="page-container-catalog">
      <Breadcrumb
        items={[
          { label: 'Catalog', to: '/casinos' },
          { label: casino.name },
        ]}
      />

      <RecentlyViewed />

      <PageHeader
        title={casino.name}
        subtitle={casino.url.replace(/^https?:\/\//, '')}
        icon={<ShieldCheck className="w-6 h-6 text-emerald-400" />}
      />

      <QuickLinkRow
        className="mb-6 animate-stagger"
        links={[
          { to: `/similar?casino=${casino.id}`, label: 'Find similar', icon: Sparkles },
          { to: `/compare?a=${encodeURIComponent(casino.id)}`, label: 'Compare', icon: Scale },
          { to: `/tools/checker?url=${encodeURIComponent(casino.url)}`, label: 'Check URL', icon: ShieldCheck },
          { to: '/random', label: 'Random pick', icon: Shuffle },
          { to: '/casinos', label: 'Browse catalog', icon: Dices },
        ]}
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

      {(copyMsg || favMsg) && (
        <NoticeBanner message={copyMsg || favMsg} variant="success" />
      )}

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
            <h3 className="section-heading text-sm font-medium text-gray-400 mb-2">Signup requirements</h3>
            <ul className="text-sm text-gray-300 list-disc list-inside">
              {casino.signupRequirements.map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {casino.features.map((f) => (
            <Link
              key={f}
              to={`/casinos?feature=${f}`}
              className={`text-xs px-2 py-0.5 rounded-full transition-opacity hover:opacity-80 ${FEATURE_COLORS[f]}`}
              title={`Browse casinos with ${FEATURE_LABELS[f]}`}
            >
              {FEATURE_LABELS[f]}
            </Link>
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

      <QuickLinkRow
        className="mt-8 pt-6 border-t border-surface-border"
        links={[
          { to: '/casinos', label: '← Back to catalog' },
          { to: `/compare?a=${encodeURIComponent(casino.id)}`, label: 'Compare this casino', icon: Scale },
          { to: `/tools/checker?url=${encodeURIComponent(casino.url)}`, label: 'URL safety check', icon: ShieldCheck },
          { to: `/similar?casino=${casino.id}`, label: 'Similar casinos', icon: Sparkles },
        ]}
      />

      <ReportSiteModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        initialUrl={casino.url}
      />
    </div>
  );
}
