import { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Copy, Check, RefreshCw } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import ToolsBreadcrumb from '../../components/ToolsBreadcrumb';
import NoticeBanner from '../../components/NoticeBanner';
import { useTimedNotice } from '../../hooks/useTimedNotice';import { usePageTitle } from '../../hooks/usePageTitle';
import { generateSecurePassword, passwordStrength } from '../../lib/generators';

export default function PasswordGeneratorPage() {
  usePageTitle('Password Generator — The Method Casinos');
  const [length, setLength] = useState(16);
  const [uppercase, setUppercase] = useState(true);
  const [lowercase, setLowercase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [password, setPassword] = useState(() => generateSecurePassword());
  const { message: copyMsg, show: showCopyMsg } = useTimedNotice();
  const copied = copyMsg === 'Password copied';

  const regenerate = () => {
    setPassword(generateSecurePassword({ length, uppercase, lowercase, numbers, symbols }));
  };

  const strength = passwordStrength(password);

  const copy = async () => {
    await navigator.clipboard.writeText(password);
    showCopyMsg('Password copied');
  };

  return (
    <div className="page-container-legal">
      <ToolsBreadcrumb page="Password generator" />
      <PageHeader
        icon={<KeyRound className="w-6 h-6 text-brand-light" />}
        title="Password Generator"
        subtitle="Create strong unique passwords for every casino account — never reuse passwords"
      />

      {copyMsg && <NoticeBanner message={copyMsg} variant="success" />}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-glow p-6 border-brand/20">
        <div className="flex items-center gap-2 p-4 rounded-xl bg-surface-muted border border-surface-border mb-6">
          <code className="flex-1 text-lg text-glow font-mono break-all">{password}</code>
          <button onClick={copy} className="p-2 text-gray-400 hover:text-glow shrink-0">
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <span className="text-sm text-gray-500">Strength</span>
          <span className={`text-sm font-semibold ${strength.color}`}>{strength.label}</span>
        </div>

        <div className="mb-6">
          <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
            Length: {length}
          </label>
          <input
            type="range"
            min={8}
            max={64}
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value))}
            className="w-full accent-brand"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: 'Uppercase', checked: uppercase, set: setUppercase },
            { label: 'Lowercase', checked: lowercase, set: setLowercase },
            { label: 'Numbers', checked: numbers, set: setNumbers },
            { label: 'Symbols', checked: symbols, set: setSymbols },
          ].map(({ label, checked, set }) => (
            <label key={label} className="flex items-center gap-2 p-3 rounded-lg bg-surface-muted border border-surface-border cursor-pointer text-sm text-gray-400">
              <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} />
              {label}
            </label>
          ))}
        </div>

        <button onClick={regenerate} className="btn-primary w-full flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4" /> Generate Password
        </button>
      </motion.div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="text-sm text-gray-600 mt-6 text-center">
        Tip: Use a password manager (Bitwarden, Proton Pass) to store one unique password per casino.
      </motion.p>
    </div>
  );
}
