import { useEffect, useState } from 'react';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { api } from '../api';
import type { Casino, SiteReport } from '../types';
import PageHeader from '../components/PageHeader';
import PendingCasinoRow from '../components/PendingCasinoRow';
import ReportRow from '../components/ReportRow';
import CatalogHealthRow from '../components/CatalogHealthRow';
import { useAuth } from '../context/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';

type Tab = 'discoveries' | 'reports' | 'health' | 'history';

export default function ReviewQueue() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: Tab =
    tabParam === 'reports' || tabParam === 'health' || tabParam === 'history' || tabParam === 'discoveries'
      ? tabParam
      : 'discoveries';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pending, setPending] = useState<Casino[]>([]);
  const [reports, setReports] = useState<SiteReport[]>([]);
  const [healthIssues, setHealthIssues] = useState<Casino[]>([]);
  const [reportHistory, setReportHistory] = useState<SiteReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      api.getPendingCasinos(),
      api.getReports(),
      api.getCatalogHealth(),
      api.getReportHistory(),
    ])
      .then(([p, r, h, hist]) => {
        setPending(p);
        setReports(r);
        setHealthIssues(h);
        setReportHistory(hist);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const next =
      tabParam === 'reports' || tabParam === 'health' || tabParam === 'history' || tabParam === 'discoveries'
        ? tabParam
        : 'discoveries';
    setTab(next);
  }, [tabParam]);

  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/dashboard" replace />;

  const approve = async (id: string) => {
    await api.approveCasino(id);
    load();
  };

  const reject = async (id: string) => {
    await api.rejectCasino(id);
    load();
  };

  const recheck = async (id: string) => {
    setBusyId(id);
    try {
      await api.revalidateCasino(id);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const unlist = async (id: string) => {
    if (!confirm('Remove this casino from the public catalog?')) return;
    setBusyId(id);
    try {
      await api.unlistCasino(id);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'discoveries', label: 'Discoveries', count: pending.length },
    { id: 'reports', label: 'Ban review', count: reports.length },
    { id: 'health', label: 'Catalog health', count: healthIssues.length },
    { id: 'history', label: 'Report history', count: reportHistory.length },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Review Queue"
        subtitle="Approve discoveries, ban rejected/scam URLs, and maintain catalog health."
        icon={<CheckCircle className="w-6 h-6 text-glow" />}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSearchParams(t.id === 'discoveries' ? {} : { tab: t.id }, { replace: true });
            }}
            className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
              tab === t.id
                ? 'border-glow/40 bg-glow/10 text-glow'
                : 'border-surface-border text-gray-400 hover:text-white'
            }`}
          >
            {t.label}{(t.count ?? 0) > 0 && ` (${t.count})`}
          </button>
        ))}
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm ml-auto">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && <p className="text-accent-red text-sm mb-4">{error}</p>}
      {loading && <p className="text-gray-500">Loading…</p>}

      {!loading && tab === 'discoveries' && !pending.length && (
        <div className="glass-glow p-8 text-center text-gray-500">
          No casinos pending review. Run a discovery scan to find new operators.
        </div>
      )}

      {!loading && tab === 'reports' && !reports.length && (
        <div className="glass-glow p-8 text-center text-gray-500">
          No URLs awaiting ban review. Rejected discovery hits and user reports appear here.
        </div>
      )}

      {!loading && tab === 'health' && !healthIssues.length && (
        <div className="glass-glow p-8 text-center text-gray-500">
          All catalog entries are healthy and recently checked.
        </div>
      )}

      {!loading && tab === 'history' && !reportHistory.length && (
        <div className="glass-glow p-8 text-center text-gray-500">No closed reports yet.</div>
      )}

      {tab === 'discoveries' && (
        <div className="space-y-3">
          {pending.map((casino) => (
            <PendingCasinoRow
              key={casino.id}
              casino={casino}
              onApprove={() => approve(casino.id)}
              onReject={() => reject(casino.id)}
            />
          ))}
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-3">
          {reports.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              onBlock={async () => {
                await api.blockFromReport(report.id);
                load();
              }}
              onDismiss={async () => {
                await api.dismissReport(report.id);
                load();
              }}
            />
          ))}
        </div>
      )}

      {tab === 'health' && (
        <div className="space-y-3">
          {healthIssues.map((casino) => (
            <CatalogHealthRow
              key={casino.id}
              casino={casino}
              busy={busyId === casino.id}
              onRecheck={() => recheck(casino.id)}
              onUnlist={() => unlist(casino.id)}
            />
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {reportHistory.map((report) => (
            <div key={report.id} className="glass p-3 text-sm">
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-white font-medium truncate">{report.url}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  report.status === 'reviewed'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-gray-500/15 text-gray-400'
                }`}>
                  {report.status}
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-1">{report.reason}</p>
              <p className="text-gray-600 text-xs mt-1">
                Reported by {report.reportedBy}
                {report.reviewedBy && ` · ${report.status} by ${report.reviewedBy}`}
                {report.reviewedAt && ` · ${new Date(report.reviewedAt).toLocaleString()}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
