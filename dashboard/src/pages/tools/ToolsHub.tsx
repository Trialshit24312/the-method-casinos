import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Phone, Wrench, ScrollText, Dices, Sparkles, Lock, Globe, Ban, KeyRound, ShieldCheck, BookOpen, Shuffle, Scale, Clock } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { ServiceGrid } from '../../components/ServiceCard';
import {
  TEMP_MAIL_SERVICES,
  SMS_RECEIVER_SITES,
  EXTRA_TOOLS,
  CASINO_SIGNUP_TOOLS,
  SWEEPS_RESEARCH,
  BROWSER_TOOLS,
} from '../../lib/generators';

const quickLinks = [
  { to: '/casinos', icon: Dices, label: 'Casinos', desc: 'Browse & filter database', color: 'text-[#b87333]' },
  { to: '/similar', icon: Sparkles, label: 'Similar', desc: 'Find alike casinos', color: 'text-glow' },
  { to: '/random', icon: Shuffle, label: 'Random', desc: 'Roll the catalog', color: 'text-glow' },
  { to: '/compare', icon: Scale, label: 'Compare', desc: 'Side-by-side', color: 'text-glow' },
  { to: '/new', icon: Clock, label: 'New', desc: 'Recent approvals', color: 'text-emerald-400' },
  { to: '/status', icon: ShieldCheck, label: 'Status', desc: 'Service health', color: 'text-emerald-400' },
  { to: '/tools/email', icon: Mail, label: 'Email Tools', desc: '30+ temp mail sites', color: 'text-glow' },
  { to: '/tools/phone', icon: Phone, label: 'Phone Tools', desc: '20+ SMS receivers', color: 'text-[#d4956a]' },
  { to: '/tools/password', icon: KeyRound, label: 'Password Gen', desc: 'Strong passwords', color: 'text-[#d4956a]' },
  { to: '/tools/checker', icon: ShieldCheck, label: 'URL Checker', desc: 'Safety check links', color: 'text-emerald-400' },
  { to: '/guides', icon: BookOpen, label: 'Guides', desc: 'Step-by-step workflows', color: 'text-[#b87333]' },
  { to: '/blocked', icon: Ban, label: 'Blocked Sites', desc: 'Scam & phishing list', color: 'text-red-400' },
  { to: '/terms', icon: ScrollText, label: 'Terms', desc: 'Legal info', color: 'text-gray-400' },
];

export default function ToolsHub() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        icon={<Wrench className="w-6 h-6 text-glow" />}
        title="Tools Hub"
        subtitle="Everything for sweepstakes casino signup — working websites, generators, VPN, and security"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        {quickLinks.map((item, i) => (
          <motion.div key={item.to} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
            <Link to={item.to} className="block p-4 rounded-xl border border-[#2a2a35] bg-[#121218]/80
              hover:border-glow/40 hover:shadow-[0_0_24px_rgba(0,174,239,0.12)] transition-all h-full text-center group">
              <item.icon className={`w-6 h-6 mx-auto mb-2 ${item.color} group-hover:scale-110 transition-transform`} />
              <p className="font-medium text-sm text-white">{item.label}</p>
              <p className="text-[10px] text-gray-600 mt-1">{item.desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-glow p-6 flex items-start gap-4 mb-10 border-glow/20">
        <Sparkles className="w-8 h-8 text-glow shrink-0" />
        <div>
          <h3 className="font-display font-semibold mb-2 text-white">The Method Workflow</h3>
          <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
            <li>Find a casino on <Link to="/casinos" className="text-glow hover:underline">Casinos</Link> — filter by no phone, VPN, slots, etc.</li>
            <li>Use <Link to="/similar" className="text-glow hover:underline">Similar Casinos</Link> to find alike sites when you like one platform</li>
            <li>Open a <Link to="/tools/email" className="text-glow hover:underline">temp-mail site</Link> for a real working inbox</li>
            <li>Generate username + password on the email tools page</li>
            <li>Sign up with email only when possible — track cash-out limits in trackables</li>
            <li>See <Link to="/assistant" className="text-glow hover:underline">Catalog Help</Link> for the full signup workflow</li>
            <li>Admins: run <Link to="/login?next=/discovery" className="text-glow hover:underline">Discovery</Link> to expand the database</li>
          </ol>
        </div>
      </motion.div>

      <ServiceGrid title="Top Temp-Mail Picks" subtitle="Most reliable for casino verification" services={TEMP_MAIL_SERVICES.slice(0, 9)} />
      <ServiceGrid title="Top SMS Receivers" subtitle="When a site requires phone OTP" services={SMS_RECEIVER_SITES.slice(0, 9)} />
      <ServiceGrid title="Recommended Browsers" subtitle="Use separate profiles per casino account" services={BROWSER_TOOLS} />

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="glass p-5 flex gap-4">
          <Lock className="w-8 h-8 text-[#b87333] shrink-0" />
          <div>
            <h4 className="font-semibold text-white mb-1">Security First</h4>
            <p className="text-sm text-gray-500">Use unique passwords per casino. Check breaches before reusing emails.</p>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="glass p-5 flex gap-4">
          <Globe className="w-8 h-8 text-glow shrink-0" />
          <div>
            <h4 className="font-semibold text-white mb-1">VPN Aware</h4>
            <p className="text-sm text-gray-500">Filter casinos by VPN status. Some block VPN — others welcome it.</p>
          </div>
        </motion.div>
      </div>

      <ServiceGrid title="Signup & Privacy" services={CASINO_SIGNUP_TOOLS} searchable />
      <ServiceGrid title="Research & Safety" services={SWEEPS_RESEARCH} />
      <ServiceGrid title="Community & Extras" services={EXTRA_TOOLS} />
    </div>
  );
}
