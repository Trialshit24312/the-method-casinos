import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ban, Plus, Search, Trash2, X, AlertTriangle, ExternalLink, Pencil } from 'lucide-react';
import { api } from '../api';
import type { BlockedSite, BlockReason, BlockSeverity } from '../types';
import { BLOCK_REASON_LABELS, BLOCK_SEVERITY_COLORS } from '../types';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import NoticeBanner from '../components/NoticeBanner';
import Breadcrumb from '../components/Breadcrumb';
import StatsSkeleton from '../components/StatsSkeleton';
import { useTimedNotice } from '../hooks/useTimedNotice';
import { SCAM_WARNING_SIGNS } from '../lib/generators';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { Link } from 'react-router-dom';

const REASONS: BlockReason[] = [
  'scam', 'phishing', 'malware', 'fake_casino', 'no_payout',
  'clone_site', 'deposit_fraud', 'spam', 'other',
];

const SEVERITIES: BlockSeverity[] = ['low', 'medium', 'high', 'critical'];

interface FormData {
  name: string;
  url: string;
  reason: BlockReason;
  severity: BlockSeverity;
  description: string;
  removeCasino: boolean;
}

const emptyForm: FormData = {
  name: '',
  url: '',
  reason: 'scam',
  severity: 'high',
  description: '',
  removeCasino: true,
};

export default function BlockedSitesPage() {
  usePageTitle('Blocked Sites — The Method Casinos');
  const { user } = useAuth();
  const [sites, setSites] = useState<BlockedSite[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { message: notice, show: showNotice } = useTimedNotice(4000);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setSites(await api.getBlockedSites(search || undefined));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load blocklist');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (site: BlockedSite) => {
    setEditingId(site.id);
    setForm({
      name: site.name,
      url: site.url,
      reason: site.reason,
      severity: site.severity,
      description: site.description,
      removeCasino: false,
    });
    setError('');
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      setError('Name and URL are required');
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await api.updateBlockedSite(editingId, {
          name: form.name,
          url: form.url,
          reason: form.reason,
          severity: form.severity,
          description: form.description,
        });
      } else {
        await api.addBlockedSite(form);
      }
      setModalOpen(false);
      setEditingId(null);
      load();
      showNotice(editingId ? 'Blocklist entry updated' : 'Site added to blocklist');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this site from the blocklist?')) return;
    try {
      await api.deleteBlockedSite(id);
      load();
      showNotice('Removed from blocklist');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to remove site');
    }
  };

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: 'Safety', to: '/tools/checker' }, { label: 'Blocklist' }]} />
      <PageHeader
        icon={<Ban className="w-6 h-6 text-red-400" />}
        title="Blocked & Dangerous Sites"
        subtitle="Scam, phishing, and fake casino URLs — discovery and manual adds are blocked automatically"
        action={
          user?.isAdmin ? (
            <button onClick={openAdd} className="btn-danger flex items-center gap-2 shrink-0">
              <Plus className="w-4 h-4" /> Block Site
            </button>
          ) : undefined
        }
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25 mb-8"
      >
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-400">
          Sites on this list are <span className="text-red-300 font-medium">never added</span> by discovery scans
          and cannot be added to the casino database. Admins can also remove matching casinos when blocking.
        </p>
      </motion.div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
        <input
          type="text"
          placeholder="Search blocked sites..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {search.trim() && !loading && (
        <div className="filter-bar mb-4">
          <span className="text-xs text-gray-500">
            {sites.length} match{sites.length === 1 ? '' : 'es'} for “{search.trim()}”
          </span>
          <button type="button" onClick={() => setSearch('')} className="text-xs text-glow hover:underline ml-auto">
            Clear search
          </button>
        </div>
      )}

      {loadError && <ErrorBanner message={loadError} onRetry={load} />}
      {notice && <NoticeBanner message={notice} variant="success" />}

      {!loading && sites.length > 0 && (
        <p className="text-sm text-gray-500 mb-4">
          {sites.length} blocked URL{sites.length === 1 ? '' : 's'}
          {' · '}
          <Link to="/tools/checker" className="text-glow hover:underline">Check a URL before signup →</Link>
        </p>
      )}

      {loading ? (
        <StatsSkeleton count={3} />
      ) : sites.length === 0 ? (
        <EmptyState
          icon={Ban}
          title={search ? 'No matches' : 'Blocklist is empty'}
          description={search ? 'Try a different search term.' : 'Known scam and phishing URLs appear here after admin review or discovery rejects.'}
          action={<Link to="/tools/checker" className="btn-glow text-sm">Open URL checker</Link>}
        />
      ) : (
        <div className="space-y-3">
          {sites.map((site, i) => (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-glow p-5 border-red-500/20 hover:border-red-500/35 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="font-semibold text-white">{site.name}</h3>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${BLOCK_SEVERITY_COLORS[site.severity]}`}>
                      {site.severity}
                    </span>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                      {BLOCK_REASON_LABELS[site.reason]}
                    </span>
                  </div>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-red-400 hover:underline flex items-center gap-1 mb-2 truncate"
                  >
                    {site.url} <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                  {site.description && (
                    <p className="text-sm text-gray-500 leading-relaxed">{site.description}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-2">
                    Reported by {site.reportedBy} · {new Date(site.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {user?.isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(site)}
                      className="p-2 rounded-lg text-gray-500 hover:text-glow hover:bg-glow/10 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(site.id)}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-6 mt-10">
        <h3 className="section-heading font-display font-semibold text-white mb-4">Know the Red Flags</h3>
        <ul className="grid sm:grid-cols-2 gap-2">
          {SCAM_WARNING_SIGNS.map((sign) => (
            <li key={sign} className="text-sm text-gray-500 flex items-start gap-2">
              <span className="text-red-400 shrink-0">•</span> {sign}
            </li>
          ))}
        </ul>
      </motion.div>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-panel max-w-lg p-6 border-red-500/30"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-semibold text-lg text-white">
                  {editingId ? 'Edit Blocked Site' : 'Block Dangerous Site'}
                </h2>
                <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && <ErrorBanner message={error} variant="warning" />}

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">Site Name</label>
                  <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fake Chumba Login" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">URL</label>
                  <input className="input-field" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">Reason</label>
                    <select className="input-field" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value as BlockReason })}>
                      {REASONS.map((r) => <option key={r} value={r}>{BLOCK_REASON_LABELS[r]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">Severity</label>
                    <select className="input-field" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as BlockSeverity })}>
                      {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">Description</label>
                  <textarea className="input-field min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Why is this site dangerous?" />
                </div>
                {!editingId && (
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={form.removeCasino} onChange={(e) => setForm({ ...form, removeCasino: e.target.checked })} className="rounded" />
                    Also remove from casino database if URL matches
                  </label>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="button" onClick={() => void submit()} disabled={saving} className="btn-danger flex-1 disabled:opacity-50">
                  {saving ? 'Saving…' : editingId ? 'Save' : 'Block Site'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
