import { Link } from 'react-router-dom';
import { Dices, Sparkles, ShieldCheck, Wrench, Scale, Activity, HelpCircle } from 'lucide-react';

const features = [
  { to: '/casinos', icon: Dices, label: 'Verified catalog', desc: 'Filter by VPN, slots & more' },
  { to: '/similar', icon: Sparkles, label: 'Similar casinos', desc: 'Match + free web search' },
  { to: '/compare', icon: Scale, label: 'Compare', desc: 'Side-by-side operators' },
  { to: '/tools/checker', icon: ShieldCheck, label: 'URL checker', desc: 'Scam & blocklist scan' },
  { to: '/tools', icon: Wrench, label: 'Signup tools', desc: 'Email, SMS, passwords' },
  { to: '/assistant', icon: HelpCircle, label: 'Catalog help', desc: 'Signup workflows' },
  { to: '/status', icon: Activity, label: 'Live status', desc: 'Bot & search engines' },
];

export default function FeatureStrip({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid ${compact ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7'} gap-3`}>
      {features.map(({ to, icon: Icon, label, desc }) => (
        <Link key={to} to={to} className="feature-pill group">
          <Icon className="w-4 h-4 text-glow shrink-0 group-hover:scale-110 transition-transform" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{label}</p>
            {!compact && <p className="text-[10px] text-gray-600 truncate">{desc}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}
