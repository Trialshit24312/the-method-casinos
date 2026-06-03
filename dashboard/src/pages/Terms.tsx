import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ScrollText,
  Shield,
  Database,
  Scale,
  Lock,
  AlertTriangle,
  Mail,
  Ban,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import {
  TERMS_SECTIONS,
  TERMS_TOC,
  TERMS_FAQ,
  LEGAL_LAST_UPDATED,
  LEGAL_VERSION,
} from '@shared/legal';
import type { LucideIcon } from 'lucide-react';

const SECTION_STYLES: Record<
  string,
  { icon: LucideIcon; accent: string }
> = {
  acceptance: { icon: ScrollText, accent: 'from-brand to-[#d4956a]' },
  service: { icon: Database, accent: 'from-[#00aeef] to-glow' },
  disclaimer: { icon: AlertTriangle, accent: 'from-amber-500 to-orange-600' },
  responsibilities: { icon: Scale, accent: 'from-violet-500 to-purple-600' },
  data: { icon: Database, accent: 'from-emerald-500 to-teal-600' },
  privacy: { icon: Lock, accent: 'from-sky-500 to-blue-600' },
  tools: { icon: Mail, accent: 'from-[#00aeef] to-cyan-500' },
  blocked: { icon: Ban, accent: 'from-red-500 to-rose-600' },
  ip: { icon: Shield, accent: 'from-brand to-[#8b5a2b]' },
  liability: { icon: AlertTriangle, accent: 'from-gray-500 to-slate-600' },
};

const SECTIONS = TERMS_SECTIONS.map((s) => ({
  ...s,
  icon: SECTION_STYLES[s.id]?.icon ?? ScrollText,
  accent: SECTION_STYLES[s.id]?.accent ?? 'from-brand to-[#d4956a]',
}));

const TOC = TERMS_TOC;
const FAQ = TERMS_FAQ;
const LAST_UPDATED = LEGAL_LAST_UPDATED;

export default function TermsPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        icon={<ScrollText className="w-6 h-6 text-[#d4956a]" />}
        title="Terms of Service"
        subtitle="Legal terms governing The Method Casinos platform, tools, and community"
      />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-surface-border mb-10"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand/15 via-transparent to-glow/10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-glow/5 rounded-full blur-3xl" />
        <div className="relative p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <span className="inline-block text-[10px] uppercase tracking-widest px-3 py-1 rounded-full
                bg-[#b87333]/20 text-[#d4956a] border border-[#b87333]/30 mb-4">
                Legal Document
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-3">
                The Method Casinos — Terms of Service
              </h2>
              <p className="text-gray-400 max-w-xl leading-relaxed">
                Read before using the dashboard, Discord bot, discovery engine, URL checker,
                or any generator tools. Questions? See our{' '}
                <Link to="/rules" className="text-glow hover:underline">Community Rules</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-glow hover:underline">Privacy Policy</Link>.
              </p>
            </div>
            <div className="shrink-0 p-5 rounded-xl bg-[#121218]/80 border border-surface-border text-center">
              <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Last Updated</p>
              <p className="text-sm font-medium text-white">{LAST_UPDATED}</p>
              <p className="text-xs text-gray-500 mt-2">Version {LEGAL_VERSION}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-8">
        {/* TOC */}
        <motion.nav
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:block"
        >
          <div className="sticky top-8 glass p-4 rounded-xl">
            <p className="text-xs uppercase tracking-widest text-[#d4956a]/80 mb-3 px-2">On this page</p>
            <ul className="space-y-1">
              {TOC.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-500
                               hover:text-glow hover:bg-glow/5 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-3 h-3 shrink-0 opacity-50" />
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </motion.nav>

        {/* Content */}
        <div className="space-y-6 min-w-0">
          {SECTIONS.map((section, i) => (
            <motion.section
              key={section.id}
              id={section.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass-glow p-6 scroll-mt-8"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${section.accent} bg-opacity-20 shrink-0`}>
                  <section.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display font-semibold text-lg text-white pt-1">{section.title}</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed mb-4 pl-0 md:pl-[3.75rem]">{section.body}</p>
              <ul className="space-y-2 pl-0 md:pl-[3.75rem]">
                {section.bullets.map((b) => (
                  <li key={b} className="text-sm text-gray-500 flex items-start gap-2">
                    <span className="text-glow mt-1 shrink-0">▸</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}

          {/* FAQ */}
          <motion.section
            id="faq"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-6 border-glow/20 scroll-mt-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <HelpCircle className="w-6 h-6 text-glow" />
              <h3 className="font-display font-semibold text-lg text-white">Frequently Asked Questions</h3>
            </div>
            <div className="space-y-4">
              {FAQ.map((item) => (
                <div key={item.q} className="p-4 rounded-xl bg-surface-muted border border-surface-border">
                  <p className="font-medium text-white text-sm mb-2">{item.q}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-6 rounded-xl border border-surface-border bg-[#121218]/60 text-center"
          >
            <p className="text-sm text-gray-500 mb-3">
              By using The Method Casinos, you acknowledge that you have read and agree to these terms.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link to="/rules" className="text-glow hover:underline">Community Rules</Link>
              <Link to="/guides" className="text-glow hover:underline">Guides</Link>
              <Link to="/blocked" className="text-glow hover:underline">Blocked Sites</Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
