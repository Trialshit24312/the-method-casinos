import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Radar, Zap, CheckCircle, SkipForward, AlertTriangle, Clock, Search, Globe, Ban, XCircle, Terminal } from 'lucide-react';
import { api } from '../api';
import type { DiscoveryResult, DiscoveryProgressEvent } from '../types';
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
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

interface LogEntry {
  id: number;
  type: DiscoveryProgressEvent['type'];
  message: string;
  tone: 'info' | 'success' | 'warn' | 'error' | 'muted';
}

function eventToLog(event: DiscoveryProgressEvent): LogEntry | null {
  switch (event.type) {
    case 'search_query':
      return { id: Date.now(), type: event.type, message: `Searching: "${event.query}"`, tone: 'info' };
    case 'search_engine':
      return { id: Date.now(), type: event.type, message: `${event.engine === 'duckduckgo' ? 'DuckDuckGo' : 'Bing'} → ${event.query.slice(0, 50)}…`, tone: 'muted' };
    case 'url_scanning':
      return { id: Date.now(), type: event.type, message: `Scanning ${shortUrl(event.url)}`, tone: 'info' };
    case 'url_added':
      return { id: Date.now(), type: event.type, message: `Added ${event.name} (${shortUrl(event.url)})`, tone: 'success' };
    case 'url_rejected':
      return { id: Date.now(), type: event.type, message: `Rejected ${shortUrl(event.url)} — ${event.reason}`, tone: 'warn' };
    case 'url_skipped':
      return { id: Date.now(), type: event.type, message: `Skipped ${shortUrl(event.url)} — ${event.reason}`, tone: 'muted' };
    case 'url_blocked':
      return { id: Date.now(), type: event.type, message: `Blocked ${shortUrl(event.url)}`, tone: 'error' };
    default:
      return null;
  }
}

export default function DiscoveryPage() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [deepRunning, setDeepRunning] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [activityLog, setActivityLog] = useState<LogEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);

  const isScanning = running || deepRunning;
  const maxSeconds = deepRunning ? 12 * 60 : 3 * 60;

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

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [activityLog]);

  const pushLog = (event: DiscoveryProgressEvent) => {
    const entry = eventToLog(event);
    if (!entry) return;
    logIdRef.current += 1;
    setActivityLog((prev) => [...prev.slice(-199), { ...entry, id: logIdRef.current }]);
  };

  const runScan = async (deep: boolean) => {
    if (!user?.isAdmin) return;
    if (deep) setDeepRunning(true);
    else setRunning(true);
    setError('');
    setResult(null);
    setActivityLog([]);

    try {
      const res = await api.discoverStream(deep, pushLog);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed — scan may have timed out. Try again.');
    } finally {
      setRunning(false);
      setDeepRunning(false);
    }
  };

  const progress = Math.min(100, (elapsed / maxSeconds) * 100);

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
        icon={<Radar className="w-6 h-6 text-[#00aeef]" />}
        title="Discovery Engine"
        subtitle="Strict validation — only real sweepstakes casinos pass. News, adult, and listicle URLs are blocked."
      />

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-glow p-6 border-[#00aeef]/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-[#00aeef]/10 border border-[#00aeef]/30">
              <Radar className="w-6 h-6 text-[#00aeef]" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg">Quick Scan</h3>
              <p className="text-sm text-gray-500">~3 min · 10 search queries · curated list</p>
            </div>
          </div>
          <ul className="text-xs text-gray-600 space-y-1 mb-4">
            <li>• 30+ verified real operators in curated list</li>
            <li>• DuckDuckGo + Bing with strict URL filters</li>
            <li>• validateSweepstakesPage() before any add</li>
          </ul>
          <button onClick={() => runScan(false)} disabled={isScanning || !user?.isAdmin}
            className="btn-primary w-full disabled:opacity-40">
            {running ? 'Quick Scan Running...' : 'Run Quick Scan'}
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-glow p-6 border-[#b87333]/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-[#b87333]/10 border border-[#b87333]/30">
              <Zap className="w-6 h-6 text-[#d4956a]" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg">Deep Scan</h3>
              <p className="text-sm text-gray-500">~12 min · all queries · crawl new sites</p>
            </div>
          </div>
          <ul className="text-xs text-gray-600 space-y-1 mb-4">
            <li>• Full 17-query search rotation</li>
            <li>• Crawls validated sites for more links</li>
            <li>• Live activity log with reject reasons</li>
          </ul>
          <button onClick={() => runScan(true)} disabled={isScanning || !user?.isAdmin}
            className="btn-glow w-full disabled:opacity-40">
            {deepRunning ? 'Deep Scan Running...' : 'Run Deep Scan'}
          </button>
        </motion.div>
      </div>

      {isScanning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-glow p-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-300 font-medium">
              {deepRunning ? 'Deep scanning the web...' : 'Quick scanning...'}
            </p>
            <span className="font-mono text-[#00aeef]">{formatElapsed(elapsed)} / {formatElapsed(maxSeconds)}</span>
          </div>
          <div className="h-2 rounded-full bg-[#1a1a22] overflow-hidden mb-4">
            <motion.div
              className="h-full bg-gradient-to-r from-[#b87333] to-[#00aeef]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          <div className="rounded-xl border border-[#2a2a35] bg-[#0d0d12] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a2a35] bg-[#121218]">
              <Terminal className="w-4 h-4 text-[#00aeef]" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Live Activity</span>
              <span className="text-xs text-gray-600 ml-auto">{activityLog.length} events</span>
            </div>
            <div ref={logRef} className="h-48 overflow-y-auto p-3 font-mono text-xs space-y-1">
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-semibold text-xl text-white">Scan Complete</h3>
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Clock className="w-4 h-4" /> {formatDuration(result.durationMs)}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-4">
            {[
              { icon: Globe, label: 'Sources', value: result.sourcesChecked, color: 'text-[#d4956a]' },
              { icon: Search, label: 'Scanned', value: result.scanned, color: 'text-[#00aeef]' },
              { icon: Radar, label: 'New Found', value: result.found, color: 'text-[#00aeef]' },
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
          {result.added > 0 && (
            <p className="text-sm text-emerald-400 mb-4">
              Added {result.added} new casino(s) — check the Casinos page to review them.
            </p>
          )}
          {result.errors.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-400 mb-2 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {result.errors.length} warning(s)
              </div>
              <ul className="text-xs text-gray-500 space-y-1 max-h-32 overflow-y-auto">
                {result.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </motion.div>
      )}

      {!user?.isAdmin && (
        <p className="text-sm text-gray-600 text-center mt-6">Admin access required to run scans</p>
      )}
    </div>
  );
}
