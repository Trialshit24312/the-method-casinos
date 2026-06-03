import { useEffect, useState } from 'react';
import { CheckCircle, RefreshCw, Search, Radar, Flag, Activity, History } from 'lucide-react';
import { api } from '../api';
import type { Casino, SiteReport } from '../types';
import PageHeader from '../components/PageHeader';
import PendingCasinoRow from '../components/PendingCasinoRow';
import ReportRow from '../components/ReportRow';
import CatalogHealthRow from '../components/CatalogHealthRow';
import EmptyState from '../components/EmptyState';
import TabPills from '../components/TabPills';
import StatsSkeleton from '../components/StatsSkeleton';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import Breadcrumb from '../components/Breadcrumb';
import { Navigate, Link, useSearchParams } from 'react-router-dom';

type Tab = 'discoveries' | 'reports' | 'health' | 'history';

export default function ReviewQueue() {
  usePageTitle('Review Queue — The Method Casinos');
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
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingFilter, setPendingFilter] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    setNotice('');
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
    const tick = () => {
      if (document.visibilityState === 'visible') load();
    };
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [tab]);

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
    setBusyId(id);
    setError('');
    try {
      await api.approveCasino(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      await api.rejectCasino(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
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

  const pendingFiltered = pending.filter((c) => {
    const q = pendingFilter.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.url.toLowerCase().includes(q);
  });

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'discoveries', label: 'Discoveries', count: pending.length },
    { id: 'reports', label: 'Ban review', count: reports.length },
    { id: 'health', label: 'Catalog health', count: healthIssues.length },
    { id: 'history', label: 'Report history', count: reportHistory.length },
  ];

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <Breadcrumb items={[{ label: 'Admin', to: '/dashboard' }, { label: 'Review queue' }]} />
      <PageHeader
        title="Review Queue"
        subtitle="Approve discoveries, ban rejected/scam URLs, and maintain catalog health."
        icon={<CheckCircle className="w-6 h-6 text-glow" />}
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <TabPills
          tabs={tabs}
          active={tab}
          onChange={(id) => {
            setTab(id as Tab);
            setSearchParams(id === 'discoveries' ? {} : { tab: id }, { replace: true });
          }}
        />
        <div className="flex flex-wrap gap-2 ml-auto">
        {tab === 'discoveries' && pending.length > 0 && (
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={async () => {
              if (!confirm(`Approve all ${pending.length} pending casinos for the public catalog?`)) return;
              try {
                const res = await api.approveAllPending(pending.length);
                load();
                setNotice(
                  res.approved > 0
                    ? `Approved ${res.approved} casino(s) for the public catalog.${res.remaining > 0 ? ` ${res.remaining} still pending.` : ''}`
                    : 'No casinos were approved.',
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Bulk approve failed');
              }
            }}
          >
            Approve all ({pending.length})
          </button>
        )}
        {tab === 'discoveries' && pending.length > 1 && (
          <button
            type="button"
            className="btn-secondary text-sm text-red-400/90"
            onClick={async () => {
              if (!confirm(`Reject all ${pending.length} pending casinos? This cannot be undone.`)) return;
              setError('');
              try {
                await Promise.all(pending.map((c) => api.rejectCasino(c.id)));
                load();
                setNotice(`Rejected ${pending.length} pending casino(s).`);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Bulk reject failed');
              }
            }}
          >
            Reject all
          </button>
        )}
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        </div>
      </div>

      {notice && <p className="text-emerald-400 text-sm mb-4">{notice}</p>}
      {error && <p className="text-accent-red text-sm mb-4">{error}</p>}
      {loading && <StatsSkeleton count={4} />}

      {!loading && tab === 'discoveries' && !pending.length && (
        <EmptyState
          icon={Radar}
          title="Queue is clear"
          description="No casinos pending review. Run a discovery scan to find new operators."
          action={<Link to="/discovery" className="btn-glow text-sm">Open discovery</Link>}
        />
      )}

      {!loading && tab === 'reports' && !reports.length && (
        <EmptyState
          icon={Flag}
          title="No ban reviews"
          description="Rejected discovery hits and user reports appear here for admin review."
        />
      )}

      {!loading && tab === 'health' && !healthIssues.length && (
        <EmptyState
          icon={Activity}
          title="All healthy"
          description="Every catalog entry passed its latest health check."
        />
      )}

      {!loading && tab === 'history' && !reportHistory.length && (
        <EmptyState
          icon={History}
          title="No report history"
          description="Closed user reports will show up here."
        />
      )}

      {tab === 'discoveries' && pending.length > 0 && (
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            className="input-field pl-9 text-sm"
            placeholder="Filter pending by name or URL…"
            value={pendingFilter}
            onChange={(e) => setPendingFilter(e.target.value)}
          />
        </div>
      )}

      {tab === 'discoveries' && (
        <div className="space-y-3">
          {pendingFiltered.map((casino) => (
            <PendingCasinoRow
              key={casino.id}
              casino={casino}
              busy={busyId === casino.id}
              onApprove={() => void approve(casino.id)}
              onReject={() => void reject(casino.id)}
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
              onPromote={async () => {
                try {
                  await api.promoteReportToDiscovery(report.id);
                  setTab('discoveries');
                  setSearchParams({}, { replace: true });
                  load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Promote failed');
                }
              }}
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
