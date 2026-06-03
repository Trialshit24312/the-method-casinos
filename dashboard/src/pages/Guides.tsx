import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Mail, ShieldCheck, Ban, Radar, Dices, KeyRound, AlertTriangle, Sparkles, Heart, Scale, Shuffle, HelpCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../context/AuthContext';

const GUIDES = [
  {
    icon: Sparkles,
    title: 'Find Similar Casinos',
    steps: [
      'Go to Similar Casinos and search for a site you already like (Chumba, Pulsz, etc.).',
      'Review match % scores — higher means closer feature overlap.',
      'Check shared tags: no phone, slots, VPN, redeem methods.',
      'Click the sparkle icon on any casino card for instant similar results.',
      'Use /similar in Discord with autocomplete for the same engine.',
    ],
  },
  {
    icon: Dices,
    title: 'Finding Good Casinos',
    steps: [
      'Browse the Casinos page — filter by No Phone, VPN Allowed, Slots, etc.',
      'Prefer verified casinos with trackables filled in (cash-out limits, min redeem).',
      'Admins run Discovery scans periodically to find new sites automatically.',
      'Use /random in Discord with filters for quick picks.',
    ],
  },
  {
    icon: Mail,
    title: 'Email-Only Signup Flow',
    steps: [
      'Open a temp-mail site from Email Tools (Mail.tm, TempMail.lol, etc.).',
      'Generate a username + password on Email Tools or Password Generator.',
      'Sign up with email + password only — skip phone if optional.',
      'Save credentials in a password manager — one unique password per casino.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Checking If a Site Is Safe',
    steps: [
      'Use the URL Safety Checker before visiting unknown links.',
      'Check the Blocked Sites list for known scams and phishing clones.',
      'Look up the domain on Trustpilot and Scam Adviser.',
      'Real sweepstakes casinos never ask for upfront payment to redeem.',
    ],
  },
  {
    icon: Ban,
    title: 'What to Avoid',
    steps: [
      '"Free coin generator" sites — always scams.',
      'Login pages that don\'t match the official casino URL.',
      'Sites pushing APK downloads from random domains.',
      'Casinos with no payout history and brand-new domains.',
    ],
  },
  {
    icon: Radar,
    title: 'Tracking & Discovery',
    steps: [
      'Fill in Cash Out Before Blocked when you learn a casino\'s limit.',
      'Add custom trackables (min redeem, daily bonus value, etc.).',
      'Admins: run Quick Scan (~8 min) or Deep Scan (~15 min) for new sites.',
      'Report scams via Block Site — removes from DB if matched.',
    ],
  },
  {
    icon: KeyRound,
    title: 'Account Security',
    steps: [
      'Never reuse passwords across casinos.',
      'Use temp mail for signups, not your main email.',
      'Enable 2FA on your password manager and Discord.',
      'Check haveibeenpwned.com if reusing any email.',
    ],
  },
];

export default function GuidesPage() {
  usePageTitle('Guides — The Method Casinos');
  const { user } = useAuth();

  const quickLinks = [
    { to: '/similar', label: 'Similar Finder', icon: Sparkles },
    { to: '/tools/checker', label: 'URL Checker', icon: ShieldCheck },
    { to: '/tools/email', label: 'Email Tools', icon: Mail },
    { to: '/tools/password', label: 'Password Gen', icon: KeyRound },
    { to: '/blocked', label: 'Blocked Sites', icon: Ban },
    { to: '/casinos', label: 'Casinos', icon: Dices },
    { to: '/random', label: 'Random Pick', icon: Shuffle },
    { to: '/compare', label: 'Compare', icon: Scale },
    { to: '/mylist', label: 'My List', icon: Heart },
    { to: '/assistant', label: 'Catalog Help', icon: HelpCircle },
    ...(user?.isAdmin
      ? [{ to: '/discovery', label: 'Discovery', icon: Radar }]
      : [{ to: '/login?next=/discovery', label: 'Discovery', icon: Radar }]),
  ];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        icon={<BookOpen className="w-6 h-6 text-brand-light" />}
        title="The Method Guides"
        subtitle="Step-by-step workflows for safe sweepstakes casino signup and research"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
        {quickLinks.map((link, i) => (
          <motion.div key={link.to} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Link
              to={link.to}
              className="block p-3 rounded-xl border border-surface-border bg-surface-raised/80
                hover:border-glow/40 text-center transition-all group card-shine"
            >
              <link.icon className="w-5 h-5 mx-auto mb-1 text-brand-light group-hover:text-glow transition-colors" />
              <span className="text-xs text-gray-400 group-hover:text-white">{link.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {GUIDES.map((guide, i) => (
          <motion.div
            key={guide.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass-glow p-6 border-surface-border"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-glow/10 border border-glow/25">
                <guide.icon className="w-5 h-5 text-glow" />
              </div>
              <h3 className="font-display font-semibold text-white">{guide.title}</h3>
            </div>
            <ol className="space-y-2 list-decimal list-inside">
              {guide.steps.map((step) => (
                <li key={step} className="text-sm text-gray-400 leading-relaxed">{step}</li>
              ))}
            </ol>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 p-5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex gap-3"
      >
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
        <p className="text-sm text-gray-400">
          The Method helps you find and organize sweepstakes casinos — you are responsible for following each site&apos;s terms of service and your local laws.
        </p>
      </motion.div>
    </div>
  );
}
