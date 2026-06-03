import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BarChart3, Download, Radar, ShieldCheck, TrendingUp } from 'lucide-react';
import { api } from '../api';
import type { DiscoveryHistoryEntry } from '../types';
import StatsSkeleton from '../components/StatsSkeleton';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import Breadcrumb from '../components/Breadcrumb';
import NoticeBanner from '../components/NoticeBanner';
import { useTimedNotice } from '../hooks/useTimedNotice';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { apiBaseUrl } from '../lib/site';

interface Insights {
  pendingCount: number;
  openReports: number;
  pendingBySource: { source: string; count: number }[];
  discoveryLast7d: { runs: number; added: number; rejected: number };
  recentRuns: DiscoveryHistoryEntry[];
  catalogGrowth30d: number;
}

function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function AdminInsights() {
  usePageTitle('Admin Insights — The Method Casinos');
  const { user } = useAuth();
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState('');
  const { message: exportMsg, show: showExportMsg } = useTimedNotice(4000);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    setError('');
    api.getAdminInsights()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  };

  useEffect(() => {
    if (!user?.isAdmin) return;
    load();
  }, [user?.isAdmin]);

  if (!user) return <Navigate to="/login?next=/insights" replace />;
  if (!user.isAdmin) return <Navigate to="/dashboard" replace />;

  const exportPendingUrl = `${apiBaseUrl()}/api/casinos/pending/export`;
  const exportCatalogUrl = `${apiBaseUrl()}/api/casinos/catalog/export`;

  const downloadCsv = (url: string, filename: string) => {
    setExporting(true);
    void fetch(url, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`Export failed (${r.status})`);
        return r.blob();
      })
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        showExportMsg(`Downloaded ${filename}`);
      })
      .catch((e) => showExportMsg(e instanceof Error ? e.message : 'Export failed'))
      .finally(() => setExporting(false));
  };

  return (
    <div className="page-container-admin">
      <Breadcrumb items={[{ label: 'Admin', to: '/dashboard' }, { label: 'Insights' }]} />
      <PageHeader
        icon={<BarChart3 className="w-6 h-6 text-glow" />}
        title="Admin Insights"
        subtitle="Discovery performance, review backlog, and catalog growth"
      />

      {error && <ErrorBanner message={error} onRetry={load} />}
      {exportMsg && <NoticeBanner message={exportMsg} variant={exportMsg.includes('Downloaded') ? 'success' : 'warning'} />}
      {!data && !error && <StatsSkeleton count={4} />}

      {data && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-stagger">
            <div className="glass-glow p-4 border-amber-500/20">
              <p className="text-xs text-gray-500 uppercase">Pending review</p>
              <p className="text-3xl font-bold text-amber-300 mt-1">{data.pendingCount}</p>
              <Link to="/review" className="text-xs text-glow hover:underline mt-2 inline-block">Open queue →</Link>
            </div>
            <div className="glass-glow p-4">
              <p className="text-xs text-gray-500 uppercase">Ban review</p>
              <p className="text-3xl font-bold text-gray-200 mt-1">{data.openReports}</p>
              <Link to="/review?tab=reports" className="text-xs text-glow hover:underline mt-2 inline-block">Review →</Link>
            </div>
            <div className="glass-glow p-4 border-emerald-500/20">
              <p className="text-xs text-gray-500 uppercase flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Catalog +30d
              </p>
              <p className="text-3xl font-bold text-emerald-300 mt-1">{data.catalogGrowth30d}</p>
              <p className="text-xs text-gray-600 mt-1">approved operators</p>
            </div>
            <div className="glass-glow p-4 border-glow/20">
              <p className="text-xs text-gray-500 uppercase">Discovery 7d</p>
              <p className="text-lg font-bold text-glow mt-1">
                +{data.discoveryLast7d.added} / {data.discoveryLast7d.rejected} rej
              </p>
              <p className="text-xs text-gray-600">{data.discoveryLast7d.runs} scan runs</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-8">
            <Link to="/discovery" className="btn-primary text-sm flex items-center gap-2">
              <Radar className="w-4 h-4" /> Run discovery
            </Link>
            <Link to="/review" className="btn-secondary text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Review queue
            </Link>
            <button
              type="button"
              disabled={exporting}
              className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
              onClick={() => downloadCsv(exportPendingUrl, 'pending-casinos.csv')}
            >
              <Download className="w-4 h-4" /> Export pending CSV
            </button>
            <button
              type="button"
              disabled={exporting}
              className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
              onClick={() => downloadCsv(exportCatalogUrl, 'verified-catalog.csv')}
            >
              <Download className="w-4 h-4" /> Export catalog CSV
            </button>
          </div>

          {data.pendingBySource.length > 0 && (
            <div className="glass-glow p-5 mb-8">
              <h3 className="font-semibold text-sm mb-3">Pending by source</h3>
              <div className="space-y-2">
                {data.pendingBySource.map((row) => (
                  <div key={row.source} className="flex justify-between text-sm">
                    <span className="text-gray-400">{row.source}</span>
                    <span className="text-white font-medium">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-glow p-5">
            <h3 className="font-semibold text-sm mb-4">Recent discovery runs</h3>
            {data.recentRuns.length === 0 ? (
              <EmptyState
                icon={Radar}
                title="No discovery runs yet"
                description="Run a scan from the Discovery page to populate this table."
                action={<Link to="/discovery" className="btn-glow text-sm">Open Discovery</Link>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase border-b border-white/10">
                      <th className="pb-2 pr-4">When</th>
                      <th className="pb-2 pr-4">Mode</th>
                      <th className="pb-2 pr-4">Added</th>
                      <th className="pb-2 pr-4">Rejected</th>
                      <th className="pb-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentRuns.map((run) => (
                      <tr key={run.id} className="border-b border-white/5 text-gray-300">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {new Date(run.ranAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4 capitalize">{run.mode}</td>
                        <td className="py-2 pr-4 text-emerald-400">{run.added}</td>
                        <td className="py-2 pr-4 text-amber-400">{run.rejected}</td>
                        <td className="py-2">{formatDuration(run.durationMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
