import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Radar, Zap, CheckCircle, SkipForward, AlertTriangle, Clock, Search, Globe, Ban, XCircle, Terminal, StopCircle, Monitor,
} from 'lucide-react';
import { api } from '../api';
import type { DiscoveryResult, DiscoveryProgressEvent, DiscoveryLiveStats, Stats, DiscoveryHistoryEntry } from '../types';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function shortUrl(url: string): string {
  try {
    return new URL(url.includes('://') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^www\./, '').split('/')[0].slice(0, 40);
  }
}

const PHASE_LABELS: Record<string, string> = {
  curated: 'Syncing verified catalog',
  search: 'Searching the web',
  analyze: 'Validating sweepstakes pages',
  crawl: 'Crawling related links',
};

interface LogEntry {
  id: number;
  type: DiscoveryProgressEvent['type'];
  message: string;
  tone: 'info' | 'success' | 'warn' | 'error' | 'muted';
}

function eventToLog(event: DiscoveryProgressEvent): LogEntry | null {
  switch (event.type) {
    case 'phase':
      return { id: Date.now(), type: event.type, message: `▸ ${event.label}`, tone: 'info' };
    case 'search_query':
      return { id: Date.now(), type: event.type, message: `Searching: "${event.query}"`, tone: 'info' };
    case 'search_engine': {
      const labels: Record<string, string> = {
        serper: 'Google (Serper)',
        duckduckgo: 'DuckDuckGo',
        duckduckgo_lite: 'DDG Lite',
        bing: 'Bing',
        brave: 'Brave',
      };
      const engineLabel = labels[event.engine] ?? event.engine;
      const count = event.linkCount != null ? ` · ${event.linkCount} links` : '';
      return {
        id: Date.now(),
        type: event.type,
        message: `${engineLabel} → ${event.query.slice(0, 50)}${count}`,
        tone: 'muted',
      };
    }
    case 'url_scanning':
      return { id: Date.now(), type: event.type, message: `Scanning ${shortUrl(event.url)}`, tone: 'info' };
    case 'crawl_summary':
      return { id: Date.now(), type: event.type, message: `▸ ${event.label}`, tone: 'muted' };
    case 'url_added':
      return { id: Date.now(), type: event.type, message: `✓ Queued for review: ${event.name} (${shortUrl(event.url)})`, tone: 'success' };
    case 'url_rejected':
      return { id: Date.now(), type: event.type, message: `✗ Rejected ${shortUrl(event.url)} — ${event.reason}`, tone: 'warn' };
    case 'url_skipped':
      return { id: Date.now(), type: event.type, message: `– Skipped ${shortUrl(event.url)} — ${event.reason}`, tone: 'muted' };
    case 'url_blocked':
      return { id: Date.now(), type: event.type, message: `Blocked ${shortUrl(event.url)}`, tone: 'error' };
    default:
      return null;
  }
}

const emptyStats = (): DiscoveryLiveStats => ({
  scanned: 0,
  queued: 0,
  added: 0,
  rejected: 0,
  skipped: 0,
  blocked: 0,
  sourcesChecked: 0,
  phase: 'curated',
  queryIndex: 0,
  queryTotal: 8,
});

export default function DiscoveryPage() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [deepRunning, setDeepRunning] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [activityLog, setActivityLog] = useState<LogEntry[]>([]);
  const [liveStats, setLiveStats] = useState<DiscoveryLiveStats>(emptyStats);
  const [phaseLabel, setPhaseLabel] = useState('');
  const [dbStats, setDbStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<DiscoveryHistoryEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const isScanning = running || deepRunning;
  const maxSeconds = deepRunning ? 30 * 60 : 8 * 60;

  useEffect(() => {
    api.getStats().then(setDbStats).catch(() => {});
    api.getDiscoveryHistory(10).then(setHistory).catch(() => {});
    if (user?.isAdmin) {
      api.getDiscoveryLive(0).then((snap) => {
        if (snap.result && !snap.running) setResult(snap.result);
      }).catch(() => {});
    }
  }, [result, user?.isAdmin]);

  useEffect(() => {
    if (!isScanning) return;
    const onClose = () => {
      abortRef.current?.abort();
      void fetch('/api/discover/cancel', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
      });
    };
    window.addEventListener('beforeunload', onClose);
    return () => window.removeEventListener('beforeunload', onClose);
  }, [isScanning]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [activityLog]);

  const pushLog = (event: DiscoveryProgressEvent) => {
    if (event.type === 'phase') {
      setPhaseLabel(event.label);
    }
    if (event.type === 'progress') {
      setLiveStats(event.stats);
    }
    const entry = eventToLog(event);
    if (!entry) return;
    logIdRef.current += 1;
    setActivityLog((prev) => [...prev.slice(-249), { ...entry, id: logIdRef.current }]);
  };

  useEffect(() => {
    if (isScanning) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isScanning]);

  const cancelScan = () => {
    abortRef.current?.abort();
    void api.cancelDiscovery().catch(() => {});
  };

  const runScan = async (deep: boolean) => {
    if (!user?.isAdmin) return;
    if (deep) setDeepRunning(true);
    else setRunning(true);
    setError('');
    setResult(null);
    setActivityLog([]);
    setLiveStats({ ...emptyStats(), queryTotal: 0 });
    setPhaseLabel('Starting…');

    abortRef.current = new AbortController();
    try {
      const res = await api.discoverStream(deep, pushLog, abortRef.current.signal);
      setResult(res);
      if (res.errors.length > 0) {
        setError(res.errors.join(' '));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Scan cancelled.');
      } else {
        setError(err instanceof Error ? err.message : 'Discovery failed — scan may have timed out.');
      }
    } finally {
      setRunning(false);
      setDeepRunning(false);
      abortRef.current = null;
    }
  };

  const workProgress = liveStats.queryTotal
    ? Math.min(100, ((liveStats.queryIndex / liveStats.queryTotal) * 40) + (liveStats.scanned * 2))
    : 0;
  const timeProgress = Math.min(100, (elapsed / maxSeconds) * 100);
  const progress = isScanning ? Math.max(workProgress, timeProgress * 0.6) : 0;

  const toneClass: Record<LogEntry['tone'], string> = {
    info: 'text-[#00aeef]',
    success: 'text-emerald-400',
    warn: 'text-amber-400',
    error: 'text-red-400',
    muted: 'text-gray-500',
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        icon={<Radar className="w-6 h-6 text-glow" />}
        title="Discovery Engine"
        subtitle="Runs from your browser while this tab is open — closes cleanly when you leave. Rejected URLs go to Ban review."
        badge={(
          <span className="pro-badge">
            <Monitor className="w-3.5 h-3.5" />
            Client-driven · Stops when tab closes
          </span>
        )}
      />

      {dbStats && (
        <p className="text-xs text-gray-500 mb-6 text-center">
          Database: {dbStats.totalCasinos} casinos ({dbStats.verifiedCasinos} verified)
          {(dbStats.staleCatalogCasinos ?? 0) > 0 && (
            <> · <span className="text-orange-400">{dbStats.staleCatalogCasinos} stale (90d+)</span></>
          )}
          {dbStats.lastDiscoveryAt && (
            <> · Last scan: {new Date(dbStats.lastDiscoveryAt).toLocaleString()}</>
          )}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-glow p-6 border-[#00aeef]/20"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-[#00aeef]/10 border border-[#00aeef]/30">
              <Radar className="w-6 h-6 text-[#00aeef]" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg">Quick Scan</h3>
              <p className="text-sm text-gray-500">~10 min · 65 searches · 350 URL checks · Serper if configured</p>
            </div>
          </div>
          <ul className="text-xs text-gray-600 space-y-1 mb-4">
            <li>• Re-checks all non-catalog URLs every scan</li>
            <li>• Mines links from every active casino in the catalog</li>
            <li>• Then runs {dbStats?.verifiedCasinos ?? '45+'} web searches with rotating queries</li>
          </ul>
          <button
            onClick={() => runScan(false)}
            disabled={isScanning || !user?.isAdmin}
            className="btn-primary w-full disabled:opacity-40"
          >
            {running ? 'Quick Scan Running…' : 'Run Quick Scan'}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-glow p-6 border-[#b87333]/20"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-[#b87333]/10 border border-[#b87333]/30">
              <Zap className="w-6 h-6 text-[#d4956a]" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg">Deep Scan</h3>
              <p className="text-sm text-gray-500">~35 min · 120 searches · 1200 URL checks · Serper + crawl</p>
            </div>
          </div>
          <ul className="text-xs text-gray-600 space-y-1 mb-4">
            <li>• 5 search pages per query (DDG Lite + Bing + Brave)</li>
            <li>• Crawls all active casinos, then 100+ web searches</li>
            <li>• Rejected URLs sent to Ban review for blocklist</li>
          </ul>
          <button
            onClick={() => runScan(true)}
            disabled={isScanning || !user?.isAdmin}
            className="btn-glow w-full disabled:opacity-40"
          >
            {deepRunning ? 'Deep Scan Running…' : 'Run Deep Scan'}
          </button>
        </motion.div>
      </div>

      {!user?.isAdmin && (
        <p className="text-sm text-gray-500 mb-6 text-center">
          Discovery scans are admin-only.{' '}
          <a href="/login" className="text-[#00aeef] hover:underline">Sign in with Discord</a> if you manage the catalog.
        </p>
      )}

      {isScanning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-glow p-8 mb-8">
          <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
            <div>
              <p className="text-gray-300 font-medium">
                {deepRunning ? 'Deep scan in progress' : 'Quick scan in progress'}
              </p>
              <p className="text-xs text-[#00aeef] mt-1">
                {phaseLabel || PHASE_LABELS[liveStats.phase] || liveStats.phase}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[#00aeef]">
                {formatElapsed(elapsed)} / {formatElapsed(maxSeconds)}
              </span>
              <button
                type="button"
                onClick={cancelScan}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10"
              >
                <StopCircle className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>

          <div className="h-2 rounded-full bg-[#1a1a22] overflow-hidden mb-4">
            <motion.div
              className="h-full bg-gradient-to-r from-[#b87333] to-[#00aeef]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {[
              { label: 'Added', value: liveStats.added, color: 'text-emerald-400' },
              { label: 'Scanned', value: liveStats.scanned, color: 'text-[#00aeef]' },
              { label: 'Rejected', value: liveStats.rejected, color: 'text-amber-400' },
              { label: 'Blocked', value: liveStats.blocked, color: 'text-red-400' },
              { label: 'Queue', value: liveStats.queued, color: 'text-gray-400' },
              { label: 'Sources', value: liveStats.sourcesChecked, color: 'text-[#d4956a]' },
              { label: 'Queries', value: `${liveStats.queryIndex}/${liveStats.queryTotal}`, color: 'text-gray-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center p-2 rounded-lg bg-[#1a1a22] border border-[#2a2a35]">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-600 uppercase">{label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#2a2a35] bg-[#0d0d12] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a2a35] bg-[#121218]">
              <Terminal className="w-4 h-4 text-[#00aeef]" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Live Activity</span>
              <span className="text-xs text-gray-600 ml-auto">{activityLog.length} events</span>
            </div>
            <div ref={logRef} className="h-56 overflow-y-auto p-3 font-mono text-xs space-y-1">
              {activityLog.length === 0 ? (
                <p className="text-gray-600 text-center py-8">Waiting for scan events…</p>
              ) : (
                activityLog.map((entry) => (
                  <div key={entry.id} className={toneClass[entry.tone]}>
                    {entry.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">{error}</div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-glow p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h3 className="font-display font-semibold text-xl text-white">
              {result.mode === 'deep' ? 'Deep' : 'Quick'} Scan Complete
            </h3>
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Clock className="w-4 h-4" /> {formatDuration(result.durationMs)}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-4">
            {[
              { icon: Globe, label: 'Sources', value: result.sourcesChecked, color: 'text-[#d4956a]' },
              { icon: Search, label: 'Scanned', value: result.scanned, color: 'text-[#00aeef]' },
              { icon: Radar, label: 'Found', value: result.found, color: 'text-[#00aeef]' },
              { icon: CheckCircle, label: 'Added', value: result.added, color: 'text-emerald-400' },
              { icon: SkipForward, label: 'Skipped', value: result.skipped, color: 'text-gray-500' },
              { icon: XCircle, label: 'Rejected', value: result.rejected, color: 'text-amber-400' },
              { icon: Ban, label: 'Blocked', value: result.blocked, color: 'text-red-400' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="text-center p-4 rounded-xl bg-[#1a1a22] border border-[#2a2a35]">
                <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-gray-600">{label}</p>
              </div>
            ))}
          </div>

          {result.addedCasinos.length > 0 && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-sm text-emerald-400 font-medium mb-1">Queued for review ({result.added}):</p>
              <p className="text-xs text-gray-500 mb-2">
                Saved to the database as pending — approve in{' '}
                <a href="/review?tab=discoveries" className="text-glow hover:underline">Review Queue → Discoveries</a>
                {' '}before they appear in the public catalog.
              </p>
              <ul className="text-sm text-gray-300 space-y-1">
                {result.addedCasinos.map((c) => (
                  <li key={c.url}>
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-glow hover:underline">
                      {c.name}
                    </a>
                    <span className="text-gray-600 text-xs ml-2">{shortUrl(c.url)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.added === 0 && (
            <p className="text-sm text-gray-500 mb-4">
              No new casinos added — all candidates were already known or failed validation.
            </p>
          )}

          {result.errors.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-400 mb-2 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {result.errors.length} warning(s)
              </div>
              <ul className="text-xs text-gray-500 space-y-1 max-h-32 overflow-y-auto">
                {result.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}

      {history.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-glow p-6 mt-8">
          <h3 className="font-display font-semibold mb-3">Recent discovery runs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-surface-border">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Mode</th>
                  <th className="py-2 pr-4">Added</th>
                  <th className="py-2 pr-4">Rejected</th>
                  <th className="py-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-surface-border/40 text-gray-300">
                    <td className="py-2 pr-4 text-xs">{new Date(h.ranAt).toLocaleString()}</td>
                    <td className="py-2 pr-4 capitalize">{h.mode}</td>
                    <td className="py-2 pr-4 text-accent-green">{h.added}</td>
                    <td className="py-2 pr-4 text-amber-400">{h.rejected}</td>
                    <td className="py-2 text-xs text-gray-500">{formatDuration(h.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-glow p-6 mt-8">
        <h3 className="font-display font-semibold mb-3">Admin tools</h3>
        <p className="text-xs text-gray-500 mb-4">
          Valid discoveries go to <a href="/review" className="text-glow hover:underline">Discoveries</a>.
          Rejected URLs go to <a href="/review" className="text-glow hover:underline">Ban review</a> for blocklist triage.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={async () => {
              if (!confirm('Re-check up to 10 stale verified casinos (homepage fetch)?')) return;
              const r = await api.revalidateCatalog(10);
              alert(`Revalidated ${r.passed}/${r.checked} OK (${r.failed} failed)`);
              api.getStats().then(setDbStats).catch(() => {});
            }}
          >
            Revalidate stale catalog
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={async () => {
              if (!confirm('Clear discovery audit log? Scans still re-check all non-catalog URLs every run.')) return;
              await api.clearDiscoverySeen();
              alert('Discovery memory cleared.');
            }}
          >
            Clear discovery audit log
          </button>
          <button
            type="button"
            className="btn-secondary text-sm text-accent-red border-accent-red/30"
            onClick={async () => {
              if (!confirm('Reset catalog to verified seeds only? Pending discoveries will be removed. Blocklist is kept.')) return;
              const r = await api.resetCatalog();
              alert(`Reset complete: ${r.casinosAdded} verified casinos loaded.`);
            }}
          >
            Reset to verified catalog
          </button>
        </div>
      </motion.div>
    </div>
  );
}
