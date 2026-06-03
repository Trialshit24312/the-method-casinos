import { Link } from 'react-router-dom';
import { Dices, Sparkles, ShieldCheck, Globe, Wrench, Radar } from 'lucide-react';

const features = [
  { to: '/casinos', icon: Dices, label: 'Verified catalog', desc: 'Filter by VPN, slots & more' },
  { to: '/similar', icon: Sparkles, label: 'Similar casinos', desc: 'Match + free web search' },
  { to: '/tools/checker', icon: ShieldCheck, label: 'URL checker', desc: 'Scam & blocklist scan' },
  { to: '/tools', icon: Wrench, label: 'Signup tools', desc: 'Email, SMS, passwords' },
  { to: '/discovery', icon: Radar, label: 'Discovery', desc: 'Find new operators' },
  { to: '/blocked', icon: Globe, label: 'Blocklist', desc: 'Known dangerous URLs' },
];

export default function FeatureStrip({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid ${compact ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'} gap-3`}>
      {features.map(({ to, icon: Icon, label, desc }) => (
        <Link
          key={to}
          to={to}
          className="feature-pill group"
        >
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
