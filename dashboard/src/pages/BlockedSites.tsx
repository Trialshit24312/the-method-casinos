import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ban, Plus, Search, Trash2, X, AlertTriangle, ExternalLink } from 'lucide-react';
import { api } from '../api';
import type { BlockedSite, BlockReason, BlockSeverity } from '../types';
import { BLOCK_REASON_LABELS, BLOCK_SEVERITY_COLORS } from '../types';
import PageHeader from '../components/PageHeader';
import { SCAM_WARNING_SIGNS } from '../lib/generators';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
  const [sites, setSites] = useState<BlockedSite[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSites(await api.getBlockedSites(search || undefined));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const openAdd = () => {
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      setError('Name and URL are required');
      return;
    }
    try {
      await api.addBlockedSite(form);
      setModalOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to block site');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this site from the blocklist?')) return;
    await api.deleteBlockedSite(id);
    load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
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

      {loading ? (
        <p className="text-gray-500 text-center py-12">Loading blocklist...</p>
      ) : sites.length === 0 ? (
        <div className="glass p-12 text-center">
          <Ban className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">No blocked sites found.</p>
        </div>
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
                  <button
                    onClick={() => remove(site.id)}
                    className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-6 mt-10">
        <h3 className="font-display font-semibold text-white mb-4">Know the Red Flags</h3>
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-glow p-6 w-full max-w-lg border-red-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-semibold text-lg text-white">Block Dangerous Site</h2>
                <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
              )}

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
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={form.removeCasino} onChange={(e) => setForm({ ...form, removeCasino: e.target.checked })} className="rounded" />
                  Also remove from casino database if URL matches
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={submit} className="btn-danger flex-1">Block Site</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
