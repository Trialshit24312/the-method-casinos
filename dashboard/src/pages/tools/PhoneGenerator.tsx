import { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Copy, Check, RefreshCw, ExternalLink, Sparkles, AlertCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { ServiceGrid } from '../../components/ServiceCard';
import { generatePhones, SMS_RECEIVER_SITES, PHONE_TOOL_SITES, GENERATOR_DISCLAIMER } from '../../lib/generators';

type PhoneFormat = 'national' | 'e164' | 'digits';

const FORMAT_LABELS: Record<PhoneFormat, string> = {
  national: '(555) 123-4567',
  e164: '+15551234567',
  digits: '15551234567',
};

const FEATURED_SMS = SMS_RECEIVER_SITES.filter((s) => s.badge === 'Popular').slice(0, 4);

export default function PhoneGeneratorPage() {
  const [format, setFormat] = useState<PhoneFormat>('national');
  const [count, setCount] = useState(5);
  const [phones, setPhones] = useState<string[]>(() => generatePhones(5, 'national'));
  const [copied, setCopied] = useState<string | null>(null);

  const regenerate = () => setPhones(generatePhones(count, format));

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const openRandom = () => {
    const pick = SMS_RECEIVER_SITES[Math.floor(Math.random() * SMS_RECEIVER_SITES.length)];
    window.open(pick.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        icon={<Phone className="w-6 h-6 text-[#d4956a]" />}
        title="Phone & SMS Tools"
        subtitle="20+ working SMS receiver websites — use when a casino requires phone OTP. Prefer email-only sites when possible."
        action={
          <button onClick={openRandom} className="btn-primary flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4" /> Open Random SMS Site
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
          <span className="text-amber-300 font-medium">Format only — NOT real phone lines:</span>{' '}
          {GENERATOR_DISCLAIMER}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10"
      >
        {FEATURED_SMS.map((svc) => (
          <a
            key={svc.url}
            href={svc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-xl border border-[#b87333]/30 bg-[#b87333]/5
                       hover:bg-[#b87333]/10 hover:border-[#b87333]/50 transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-white group-hover:text-[#d4956a]">{svc.name}</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#d4956a]" />
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">{svc.description}</p>
          </a>
        ))}
      </motion.div>

      <ServiceGrid
        title="Free SMS Receiver Websites"
        subtitle="Public numbers — texts appear live in your browser"
        services={SMS_RECEIVER_SITES}
        searchable
      />

      <ServiceGrid
        title="Virtual Number Services"
        subtitle="Paid/rental options when free numbers don't work"
        services={PHONE_TOOL_SITES}
        searchable
      />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-glow p-6 max-w-2xl border-[#b87333]/20">
        <h3 className="font-display font-semibold mb-2 text-[#d4956a]">Format Generator</h3>
        <p className="text-sm text-gray-500 mb-4">Format only, NOT real SMS lines — use SMS receiver sites above for OTP</p>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wide">Format</label>
            <select className="input-field" value={format} onChange={(e) => setFormat(e.target.value as PhoneFormat)}>
              {(Object.keys(FORMAT_LABELS) as PhoneFormat[]).map((f) => (
                <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wide">Count</label>
            <input type="number" min={1} max={25} className="input-field" value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 1)} />
          </div>
        </div>
        <button onClick={regenerate} className="btn-primary w-full flex items-center justify-center gap-2 mb-4">
          <RefreshCw className="w-4 h-4" /> Generate Numbers
        </button>
        <div className="space-y-2">
          {phones.map((phone) => (
            <div key={phone} className="flex items-center gap-2 p-3 rounded-lg bg-surface-muted border border-surface-border">
              <code className="flex-1 text-sm text-[#d4956a] font-mono">{phone}</code>
              <button onClick={() => copy(phone)} className="p-2 text-gray-400 hover:text-[#d4956a]">
                {copied === phone ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
