import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Copy, Check, RefreshCw, KeyRound, User, ExternalLink, Sparkles, AlertCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { ServiceGrid } from '../../components/ServiceCard';
import {
  generateEmail,
  generateEmails,
  generatePassword,
  generateUsername,
  EMAIL_DOMAINS,
  TEMP_MAIL_SERVICES,
  CASINO_SIGNUP_TOOLS,
  GENERATOR_DISCLAIMER,
} from '../../lib/generators';

const FEATURED = TEMP_MAIL_SERVICES.filter((s) => s.badge === 'Popular').slice(0, 4);

export default function EmailGeneratorPage() {
  const [domain, setDomain] = useState('');
  const [batch, setBatch] = useState(5);
  const [emails, setEmails] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const regenerate = () => {
    setEmails(generateEmails(batch, domain || undefined));
    setPassword(generatePassword());
    setUsername(generateUsername());
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const openRandom = () => {
    const pick = TEMP_MAIL_SERVICES[Math.floor(Math.random() * TEMP_MAIL_SERVICES.length)];
    window.open(pick.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        icon={<Mail className="w-6 h-6 text-glow" />}
        title="Email & Signup Tools"
        subtitle="30+ working temp-mail websites plus generators for casino signups — every link opens a real inbox"
        action={
          <button onClick={openRandom} className="btn-glow flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4" /> Open Random Temp Mail
          </button>
        }
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 mb-8"
      >
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-400">
          <span className="text-amber-300 font-medium">Format only — NOT real inboxes:</span>{' '}
          {GENERATOR_DISCLAIMER}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10"
      >
        {FEATURED.map((svc) => (
          <a
            key={svc.url}
            href={svc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-xl border border-glow/30 bg-glow/5
                       hover:bg-glow/10 hover:border-glow/50 transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-white group-hover:text-glow">{svc.name}</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-glow" />
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">{svc.description}</p>
          </a>
        ))}
      </motion.div>

      <ServiceGrid
        title="All Working Temp-Mail Websites"
        subtitle="Click any card — opens a live disposable inbox in a new tab"
        services={TEMP_MAIL_SERVICES}
        searchable
      />

      <div className="grid lg:grid-cols-2 gap-6 mb-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-glow p-6 border-glow/20">
          <h3 className="font-display font-semibold mb-1 text-glow">Random Email Generator</h3>
          <p className="text-xs text-amber-400/80 mb-4">Format only, NOT real inboxes — use temp-mail sites above for working mail</p>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wide">Domain</label>
              <select className="input-field" value={domain} onChange={(e) => setDomain(e.target.value)}>
                <option value="">Random</option>
                {EMAIL_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wide">Count</label>
              <input type="number" min={1} max={25} className="input-field" value={batch}
                onChange={(e) => setBatch(parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <button onClick={regenerate} className="btn-primary w-full flex items-center justify-center gap-2 mb-4">
            <RefreshCw className="w-4 h-4" /> Generate Pack
          </button>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(emails.length ? emails : [generateEmail(domain || undefined)]).map((email) => (
              <div key={email} className="flex items-center gap-2 p-3 rounded-lg bg-surface-muted border border-surface-border">
                <code className="flex-1 text-sm text-glow truncate">{email}</code>
                <button onClick={() => copy(email)} className="p-2 rounded-lg hover:bg-glow/10 text-gray-400">
                  {copied === email ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass p-6 space-y-4 border-brand/20">
          <h3 className="font-display font-semibold text-brand-light">Signup Identity Pack</h3>
          <p className="text-sm text-gray-500">Username + password combos for new casino accounts</p>
          {[
            { label: 'Username', value: username || generateUsername(), icon: User },
            { label: 'Password', value: password || generatePassword(), icon: KeyRound },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="p-3 rounded-lg bg-surface-muted border border-surface-border">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><Icon className="w-3 h-3" />{label}</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-white truncate">{value}</code>
                <button onClick={() => copy(value)} className="p-1.5 text-gray-400 hover:text-glow">
                  {copied === value ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
          <button onClick={regenerate} className="btn-secondary w-full text-sm">Regenerate Identity</button>
        </motion.div>
      </div>

      <ServiceGrid title="Signup & Privacy Tools" subtitle="Aliases, VPNs, and security for casino accounts" services={CASINO_SIGNUP_TOOLS} searchable />
    </div>
  );
}
