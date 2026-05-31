import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, Search, ExternalLink, AlertTriangle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { ServiceGrid } from '../../components/ServiceCard';
import { api } from '../../api';
import type { UrlCheckResult } from '../../types';
import { BLOCK_REASON_LABELS } from '../../types';
import { SCAM_WARNING_SIGNS, SWEEPS_RESEARCH } from '../../lib/generators';

export default function UrlCheckerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UrlCheckResult | null>(null);
  const [error, setError] = useState('');

  const check = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.checkUrl(url.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        icon={<ShieldCheck className="w-6 h-6 text-[#00aeef]" />}
        title="URL Safety Checker"
        subtitle="Check if a casino URL is in our database, on the blocklist, or unknown"
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-glow p-6 mb-8 border-[#00aeef]/20">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              className="input-field pl-10"
              placeholder="https://example-casino.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && check()}
            />
          </div>
          <button onClick={check} disabled={loading} className="btn-glow px-6 disabled:opacity-40">
            {loading ? 'Checking...' : 'Check URL'}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            {result.blocked ? (
              <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
                  <ShieldAlert className="w-5 h-5" /> DANGEROUS — DO NOT VISIT
                </div>
                {result.blockedSite && (
                  <>
                    <p className="text-white font-medium">{result.blockedSite.name}</p>
                    <p className="text-sm text-red-300/80 mt-1">
                      {BLOCK_REASON_LABELS[result.blockedSite.reason]} · {result.blockedSite.severity}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">{result.blockedSite.description}</p>
                  </>
                )}
              </div>
            ) : result.casino ? (
              <div className={`p-5 rounded-xl border ${result.safe ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <div className={`flex items-center gap-2 font-semibold mb-2 ${result.safe ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <ShieldCheck className="w-5 h-5" />
                  {result.safe ? 'Verified in Database' : 'In Database (Unverified)'}
                </div>
                <p className="text-white font-medium">{result.casino.name}</p>
                <p className="text-sm text-gray-500 mt-1">Rating: {result.casino.rating.toFixed(1)}/5</p>
                <a href={result.casino.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#00aeef] mt-3 hover:underline">
                  Visit site <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
                  <AlertTriangle className="w-5 h-5" /> Unknown URL
                </div>
                <p className="text-sm text-gray-400">
                  Not in our database or blocklist. Proceed with caution — check the scam signs below.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-6 mb-10">
        <h3 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" /> Scam Warning Signs
        </h3>
        <ul className="space-y-2">
          {SCAM_WARNING_SIGNS.map((sign) => (
            <li key={sign} className="text-sm text-gray-400 flex items-start gap-2">
              <span className="text-red-400 shrink-0">•</span> {sign}
            </li>
          ))}
        </ul>
      </motion.div>

      <ServiceGrid title="Research Before You Sign Up" subtitle="External tools to verify unfamiliar casinos" services={SWEEPS_RESEARCH} />
    </div>
  );
}
