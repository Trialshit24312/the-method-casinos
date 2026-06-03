import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Bot, Radar, Shield, Sparkles } from 'lucide-react';
import { api } from '../api';
import type { Stats } from '../types';
import PageHeader from '../components/PageHeader';
import { usePageTitle } from '../hooks/usePageTitle';

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
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getStatus().then(setStatus).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        icon={<Activity className="w-6 h-6 text-emerald-400" />}
        title="Service Status"
        subtitle="Live catalog stats, bot connection, and free web search engines — 100% no paid APIs."
      />

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {status && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className={`glass-glow p-4 flex items-center gap-3 ${status.ok ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
            <span className={`w-3 h-3 rounded-full ${status.ok ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="font-medium text-white">{status.ok ? 'All systems operational' : 'Degraded'}</span>
            <span className="text-xs text-gray-500 ml-auto">Uptime {formatUptime(status.uptime)}</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Shield, label: 'Verified casinos', value: status.stats.verifiedCasinos, color: 'text-emerald-400' },
              { icon: Sparkles, label: 'Total catalog', value: status.stats.totalCasinos, color: 'text-glow' },
              { icon: Radar, label: 'Search mode', value: status.searchMode, color: 'text-brand-light' },
              { icon: Bot, label: 'Discord bot', value: status.bot ? 'Online' : 'Offline', color: status.bot ? 'text-[#5865F2]' : 'text-gray-500' },
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
            <Link to="/similar" className="text-glow hover:underline">Similar search</Link>
            <Link to="/tools/checker" className="text-glow hover:underline">URL checker</Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
