import { useEffect, useState } from 'react';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { api } from '../api';
import type { Casino, SiteReport } from '../types';
import PageHeader from '../components/PageHeader';
import PendingCasinoRow from '../components/PendingCasinoRow';
import ReportRow from '../components/ReportRow';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

type Tab = 'discoveries' | 'reports';

export default function ReviewQueue() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('discoveries');
  const [pending, setPending] = useState<Casino[]>([]);
  const [reports, setReports] = useState<SiteReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([api.getPendingCasinos(), api.getReports()])
      .then(([p, r]) => {
        setPending(p);
        setReports(r);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Review Queue"
        subtitle="Approve discovery results and triage user reports before they affect the public catalog."
        icon={<CheckCircle className="w-6 h-6 text-glow" />}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('discoveries')}
          className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
            tab === 'discoveries'
              ? 'border-glow/40 bg-glow/10 text-glow'
              : 'border-surface-border text-gray-400 hover:text-white'
          }`}
        >
          Discoveries {pending.length > 0 && `(${pending.length})`}
        </button>
        <button
          type="button"
          onClick={() => setTab('reports')}
          className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
            tab === 'reports'
              ? 'border-glow/40 bg-glow/10 text-glow'
              : 'border-surface-border text-gray-400 hover:text-white'
          }`}
        >
          User reports {reports.length > 0 && `(${reports.length})`}
        </button>
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
          No open user reports.
        </div>
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
    </div>
  );
}
