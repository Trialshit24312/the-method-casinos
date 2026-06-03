import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  Database,
  Ban,
  Radar,
  MessageSquare,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Users,
  Lock,
  ChevronRight,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { usePageTitle } from '../hooks/usePageTitle';
import { FEATURE_LABELS, FEATURE_CATEGORIES } from '../types';
import {
  RULES_CATEGORIES,
  RULES_CONSEQUENCES,
  RULES_DO_SUMMARY,
  RULES_DONT_SUMMARY,
} from '@shared/legal';
import type { LucideIcon } from 'lucide-react';

const CATEGORY_STYLES: Record<string, { icon: LucideIcon; color: string; border: string }> = {
  standards: { icon: Shield, color: 'text-glow', border: 'border-glow/30' },
  admin: { icon: Lock, color: 'text-brand-light', border: 'border-brand/30' },
  tags: { icon: Database, color: 'text-emerald-400', border: 'border-emerald-500/30' },
  community: { icon: MessageSquare, color: 'text-violet-400', border: 'border-violet-500/30' },
};

const CATEGORIES = RULES_CATEGORIES.map((c) => ({
  ...c,
  ...CATEGORY_STYLES[c.id],
}));

const CONSEQUENCE_COLORS: Record<string, string> = {
  Warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  'Access Revoked': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  'Permanent Ban': 'text-red-400 bg-red-500/10 border-red-500/30',
};

const CONSEQUENCES = RULES_CONSEQUENCES.map((c) => ({
  ...c,
  color: CONSEQUENCE_COLORS[c.level] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/30',
}));

export default function RulesPage() {
  usePageTitle('Community Rules — The Method Casinos');
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        icon={<Shield className="w-6 h-6 text-glow" />}
        title="Community Rules"
        subtitle="Precision · Strategy · Execution — standards that keep The Method clean and useful"
      />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-glow/20 mb-10"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-glow/10 via-transparent to-brand/10" />
        <div className="relative p-8 md:p-10 flex flex-col md:flex-row gap-6 items-start">
          <div className="p-4 rounded-2xl bg-glow/10 border border-glow/25 shrink-0">
            <Shield className="w-10 h-10 text-glow" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">The Method Standard</h2>
            <p className="text-gray-400 leading-relaxed max-w-2xl mb-4">
              The Method Casinos is a private research hub for sweepstakes casinos with easy signup.
              These rules keep the database accurate, the tools working, and the community trustworthy.
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { icon: Users, label: 'Community-first' },
                { icon: Ban, label: 'Zero scam tolerance' },
                { icon: Radar, label: 'Smart discovery' },
                { icon: Wrench, label: 'Tools for good' },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full
                  bg-surface-muted border border-surface-border text-gray-400">
                  <Icon className="w-3 h-3 text-brand" /> {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Do / Don't summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid md:grid-cols-2 gap-4 mb-10"
      >
        <div className="glass p-5 border-emerald-500/20">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-3">
            <CheckCircle2 className="w-5 h-5" /> Do This
          </div>
          <ul className="space-y-2 text-sm text-gray-400">
            {RULES_DO_SUMMARY.map((t) => (
              <li key={t} className="flex gap-2"><span className="text-emerald-500">✓</span>{t}</li>
            ))}
          </ul>
        </div>
        <div className="glass p-5 border-red-500/20">
          <div className="flex items-center gap-2 text-red-400 font-semibold mb-3">
            <XCircle className="w-5 h-5" /> Never Do This
          </div>
          <ul className="space-y-2 text-sm text-gray-400">
            {RULES_DONT_SUMMARY.map((t) => (
              <li key={t} className="flex gap-2"><span className="text-red-500">✗</span>{t}</li>
            ))}
          </ul>
        </div>
      </motion.div>

      {/* Rule categories */}
      <div className="space-y-10 mb-12">
        {CATEGORIES.map((cat, ci) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ci * 0.08 }}
          >
            <div className={`flex items-center gap-3 mb-4 pb-3 border-b ${cat.border}`}>
              <cat.icon className={`w-5 h-5 ${cat.color}`} />
              <h2 className="font-display font-semibold text-xl text-white">{cat.label}</h2>
            </div>
            <div className="grid gap-4">
              {cat.rules.map((rule) => (
                <div key={rule.title} className="glass-glow p-5">
                  <h3 className="font-semibold text-white mb-2">{rule.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-4">{rule.body}</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                      <p className="text-[10px] uppercase tracking-wide text-emerald-400 mb-2">Do</p>
                      <ul className="space-y-1">
                        {rule.do.map((d) => (
                          <li key={d} className="text-xs text-gray-500 flex gap-1.5">
                            <ChevronRight className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />{d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/15">
                      <p className="text-[10px] uppercase tracking-wide text-red-400 mb-2">Don&apos;t</p>
                      <ul className="space-y-1">
                        {rule.dont.map((d) => (
                          <li key={d} className="text-xs text-gray-500 flex gap-1.5">
                            <ChevronRight className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />{d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Consequences */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-12"
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertOctagon className="w-5 h-5 text-amber-400" />
          <h2 className="font-display font-semibold text-xl text-white">Enforcement</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {CONSEQUENCES.map((c) => (
            <div key={c.level} className={`p-4 rounded-xl border ${c.color}`}>
              <p className="font-semibold text-sm mb-1">{c.level}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Feature reference */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass p-6 mb-8 border-brand/20"
      >
        <h2 className="font-display font-semibold text-lg text-white mb-2">Feature Tag Reference</h2>
        <p className="text-sm text-gray-500 mb-6">
          Use these categories when tagging casinos. Full list available when editing on the{' '}
          <Link to="/casinos" className="text-glow hover:underline">Casinos page</Link>.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURE_CATEGORIES.map((cat) => (
            <div key={cat.label} className="p-4 rounded-xl bg-surface-muted border border-surface-border">
              <p className="text-xs uppercase tracking-wide text-brand-light mb-2">{cat.label}</p>
              <div className="flex flex-wrap gap-1">
                {cat.features.slice(0, 8).map((f) => (
                  <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-panel text-gray-500 border border-surface-border">
                    {FEATURE_LABELS[f]}
                  </span>
                ))}
                {cat.features.length > 8 && (
                  <span className="text-[10px] text-gray-600">+{cat.features.length - 8}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Footer links */}
      <div className="p-6 rounded-xl border border-surface-border bg-surface-panel/60 text-center">
        <p className="text-sm text-gray-500 mb-3">
          Rules work alongside our Terms of Service. By participating, you agree to both.
        </p>
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <Link to="/terms" className="text-glow hover:underline">Terms of Service</Link>
          <Link to="/privacy" className="text-glow hover:underline">Privacy</Link>
          <Link to="/guides" className="text-glow hover:underline">Guides</Link>
          <Link to="/blocked" className="text-glow hover:underline">Blocked Sites</Link>
        </div>
      </div>
    </div>
  );
}
