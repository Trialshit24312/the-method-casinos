import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Bot, Radar, Shield, Sparkles, RefreshCw } from 'lucide-react';
import { api } from '../api';
import type { Stats } from '../types';
import PageHeader from '../components/PageHeader';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../context/AuthContext';

interface ServiceStatus {
  ok: boolean;
  searchMode: string;
  searchEngines: string[];
  bot: boolean;
  stats: Pick<Stats, 'verifiedCasinos' | 'totalCasinos' | 'noPhoneCasinos' | 'blockedSites'>;
  uptime: number;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function StatusPage() {
  usePageTitle('Status — The Method Casinos');
  const { user } = useAuth();
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof api.getHealth>> | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const [s, h] = await Promise.all([
        api.getStatus(),
        api.getHealth().catch(() => null),
      ]);
      setStatus(s);
      setHealth(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load status');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        icon={<Activity className="w-6 h-6 text-emerald-400" />}
        title="Service Status"
        subtitle="Live catalog stats, bot connection, and free web search engines — 100% no paid APIs."
        action={
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {status && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className={`glass-glow p-4 flex items-center gap-3 ${status.ok ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
            <span className={`w-3 h-3 rounded-full ${status.ok ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="font-medium text-white">{status.ok ? 'All systems operational' : 'Degraded'}</span>
            <span className="text-xs text-gray-500 ml-auto">API uptime {formatUptime(status.uptime)}</span>
          </div>

          {health && user?.isAdmin && (
            <div className="glass-glow p-4 border-amber-500/20">
              <p className="text-xs uppercase tracking-wide text-amber-400/80 mb-3">Admin operations</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[
                  { label: 'Pending review', value: health.pendingReview, to: '/review' },
                  { label: 'Open reports', value: health.openReports, to: '/review?tab=reports' },
                  { label: 'Stale catalog', value: health.staleCatalog, to: '/review?tab=health' },
                  { label: 'Failed health', value: health.failedHealth, to: '/review?tab=health' },
                ].map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-glow/30 transition-colors"
                  >
                    <p className="text-xl font-bold text-white">{item.value}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{item.label}</p>
                  </Link>
                ))}
              </div>
              {health.discoveryRunning && (
                <p className="text-sm text-[#00aeef] mt-3 flex items-center gap-2">
                  <Radar className="w-4 h-4 animate-pulse" />
                  Server discovery scan in progress —{' '}
                  <Link to="/discovery" className="underline">open Discovery</Link>
                </p>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Shield, label: 'Verified casinos', value: status.stats.verifiedCasinos, color: 'text-emerald-400' },
              { icon: Sparkles, label: 'Total catalog', value: status.stats.totalCasinos, color: 'text-glow' },
              { icon: Radar, label: 'Search mode', value: status.searchMode, color: 'text-brand-light' },
              { icon: Bot, label: 'Discord bot', value: health?.botTag && status.bot ? health.botTag : (status.bot ? 'Online' : 'Offline'), color: status.bot ? 'text-[#5865F2]' : 'text-gray-500' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="stat-card">
                <Icon className={`w-5 h-5 ${color} mb-2`} />
                <p className="text-2xl font-display font-bold capitalize">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>

          <div className="glass p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Free search engines</p>
            <div className="flex flex-wrap gap-2">
              {status.searchEngines.map((e) => (
                <span key={e} className="text-xs px-2 py-1 rounded-full bg-glow/10 text-glow border border-glow/25">{e}</span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/casinos" className="text-glow hover:underline">Browse catalog</Link>
            <Link to="/random" className="text-glow hover:underline">Random pick</Link>
            <Link to="/similar" className="text-glow hover:underline">Similar search</Link>
            <Link to="/tools/checker" className="text-glow hover:underline">URL checker</Link>
            {user?.isAdmin && (
              <Link to="/insights" className="text-amber-400 hover:underline">Admin insights</Link>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
