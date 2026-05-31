import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, X, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { Casino, CasinoFeature, Trackable } from '../types';
import { FEATURE_LABELS, FEATURE_CATEGORIES } from '../types';
import PageHeader from '../components/PageHeader';
import CasinoCard from '../components/CasinoCard';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { isCatalogStale } from '../lib/freshness';

interface FormData {
  name: string;
  url: string;
  description: string;
  features: CasinoFeature[];
  signupRequirements: string;
  bonusInfo: string;
  cashOutBeforeBlocked: string;
  trackables: Trackable[];
  rating: number;
  verified: boolean;
}

const emptyForm: FormData = {
  name: '',
  url: '',
  description: '',
  features: ['sweepstakes'],
  signupRequirements: 'Email, Password',
  bonusInfo: '',
  cashOutBeforeBlocked: '',
  trackables: [],
  rating: 0,
  verified: false,
};

export default function CasinosPage() {
  const { user } = useAuth();
  usePageTitle('Browse Casinos — The Method');
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CasinoFeature | ''>('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Casino | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [staleOnly, setStaleOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCasinos(search || undefined, user?.isAdmin && showAll);
      setCasinos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, showAll, user?.isAdmin]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const filtered = (filter
    ? casinos.filter((c) => c.features.includes(filter))
    : casinos
  ).filter((c) => !staleOnly || isCatalogStale(c.lastCheckedAt));

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (casino: Casino) => {
    setEditing(casino);
    setForm({
      name: casino.name,
      url: casino.url,
      description: casino.description,
      features: casino.features,
      signupRequirements: casino.signupRequirements.join(', '),
      bonusInfo: casino.bonusInfo,
      cashOutBeforeBlocked: casino.cashOutBeforeBlocked != null ? String(casino.cashOutBeforeBlocked) : '',
      trackables: casino.trackables?.length ? [...casino.trackables] : [],
      rating: casino.rating,
      verified: casino.verified,
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cashOut = form.cashOutBeforeBlocked.trim();
    const { cashOutBeforeBlocked: _c, signupRequirements: signupRaw, trackables: trackablesRaw, ...rest } = form;
    const payload = {
      ...rest,
      signupRequirements: signupRaw.split(',').map((s) => s.trim()).filter(Boolean),
      cashOutBeforeBlocked: cashOut ? parseFloat(cashOut) : null,
      trackables: trackablesRaw.filter((t) => t.label.trim()),
    };

    try {
      if (editing) {
        await api.updateCasino(editing.id, payload);
      } else {
        await api.addCasino(payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!editing || !confirm(`Delete ${editing.name}?`)) return;
    try {
      await api.deleteCasino(editing.id);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleBlock = async (casino: Casino) => {
    if (!confirm(`Block "${casino.name}" as dangerous and remove from casinos?`)) return;
    try {
      await api.addBlockedSite({
        name: casino.name,
        url: casino.url,
        reason: 'scam',
        severity: 'high',
        description: `Blocked from casino list — reported as dangerous/scam.`,
        removeCasino: true,
      });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to block');
    }
  };

  const toggleFeature = (f: CasinoFeature) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(f)
        ? prev.features.filter((x) => x !== f)
        : [...prev.features, f],
    }));
  };

  const addTrackable = () => {
    setForm((prev) => ({
      ...prev,
      trackables: [...prev.trackables, { label: '', value: 0 }],
    }));
  };

  const updateTrackable = (index: number, field: keyof Trackable, value: string) => {
    setForm((prev) => {
      const trackables = [...prev.trackables];
      trackables[index] = {
        ...trackables[index],
        [field]: field === 'value' ? parseFloat(value) || 0 : value,
      };
      return { ...prev, trackables };
    });
  };

  const removeTrackable = (index: number) => {
    setForm((prev) => ({
      ...prev,
      trackables: prev.trackables.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Casinos"
        subtitle={showAll && user?.isAdmin ? `${filtered.length} casino(s) including pending` : `${filtered.length} verified catalog casino(s)`}
        action={
          user?.isAdmin ? (
            <button onClick={openAdd} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Casino
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search casinos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as CasinoFeature | '')}
          className="input-field sm:w-56"
        >
          <option value="">All features</option>
          {FEATURE_CATEGORIES.map((cat) => (
            <optgroup key={cat.label} label={cat.label}>
              {cat.features.map((f) => (
                <option key={f} value={f}>{FEATURE_LABELS[f]}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {user?.isAdmin && (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-400 shrink-0 cursor-pointer px-2">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-surface-border"
              />
              Show pending
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400 shrink-0 cursor-pointer px-2">
              <input
                type="checkbox"
                checked={staleOnly}
                onChange={(e) => setStaleOnly(e.target.checked)}
                className="rounded border-surface-border"
              />
              Stale only
            </label>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((casino, i) => (
            <CasinoCard
              key={casino.id}
              casino={casino}
              index={i}
              admin={user?.isAdmin}
              onEdit={openEdit}
              onBlock={handleBlock}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          No casinos found. {user?.isAdmin && 'Add one or run a discovery scan.'}
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold">
                  {editing ? 'Edit Casino' : 'Add Casino'}
                </h2>
                <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-accent-red/10 border border-accent-red/30 rounded-lg text-accent-red text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Name</label>
                  <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">URL</label>
                  <input className="input-field" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required type="url" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Description</label>
                  <textarea className="input-field h-20 resize-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Signup Requirements (comma-separated)</label>
                  <input className="input-field" value={form.signupRequirements} onChange={(e) => setForm({ ...form, signupRequirements: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Bonus Info</label>
                  <input className="input-field" value={form.bonusInfo} onChange={(e) => setForm({ ...form, bonusInfo: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Rating (0-5)</label>
                  <input className="input-field" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: parseFloat(e.target.value) })} />
                </div>

                <div className="p-4 rounded-lg bg-surface-overlay border border-surface-border space-y-3">
                  <h3 className="text-sm font-medium text-gray-300">Trackables</h3>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Cash Out Before Blocked ($)</label>
                    <input
                      className="input-field"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 500"
                      value={form.cashOutBeforeBlocked}
                      onChange={(e) => setForm({ ...form, cashOutBeforeBlocked: e.target.value })}
                    />
                  </div>

                  {form.trackables.map((t, i) => (
                    <div key={i} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">Label</label>
                        <input
                          className="input-field"
                          placeholder="e.g. Min Redeem Amount"
                          value={t.label}
                          onChange={(e) => updateTrackable(i, 'label', e.target.value)}
                        />
                      </div>
                      <div className="w-28">
                        <label className="text-xs text-gray-500 mb-1 block">Value ($)</label>
                        <input
                          className="input-field"
                          type="number"
                          min="0"
                          step="0.01"
                          value={t.value}
                          onChange={(e) => updateTrackable(i, 'value', e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTrackable(i)}
                        className="p-2 text-gray-500 hover:text-accent-red transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <button type="button" onClick={addTrackable} className="btn-secondary text-sm w-full">
                    + Add Trackable
                  </button>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Features</label>
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                    {FEATURE_CATEGORIES.map((cat) => (
                      <div key={cat.label}>
                        <p className="text-[10px] uppercase tracking-wide text-[#d4956a]/80 mb-2">{cat.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {cat.features.map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => toggleFeature(f)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                form.features.includes(f)
                                  ? 'bg-brand/20 border-brand/50 text-brand-light'
                                  : 'border-surface-border text-gray-500 hover:text-gray-300'
                              }`}
                            >
                              {FEATURE_LABELS[f]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} className="rounded" />
                  Verified casino
                </label>

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="btn-primary flex-1">
                    {editing ? 'Save Changes' : 'Add Casino'}
                  </button>
                  {editing && (
                    <button type="button" onClick={handleDelete} className="btn-danger">
                      Delete
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
