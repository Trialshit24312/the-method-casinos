import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Dices, Sparkles, ShieldCheck, Mail, Radar, Heart, Scale, Shuffle, BookOpen, ArrowRight,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../context/AuthContext';

const workflows = [
  {
    title: 'Find a verified casino',
    desc: 'Browse the admin-reviewed catalog with filters for no-phone signup, slots, VPN policy, and redeem options.',
    to: '/casinos',
    icon: Dices,
    accent: 'from-brand/20',
  },
  {
    title: 'Check before you click',
    desc: 'Run any URL through the blocklist + catalog lookup before signing up.',
    to: '/tools/checker',
    icon: ShieldCheck,
    accent: 'from-emerald-500/15',
  },
  {
    title: 'Signup without your real email',
    desc: 'Open a temp-mail provider, generate a password, and copy a signup kit from any casino profile.',
    to: '/tools/email',
    icon: Mail,
    accent: 'from-glow/20',
  },
  {
    title: 'Find operators like one you trust',
    desc: 'Match from the verified catalog or search the web from your browser for similar sweepstakes sites.',
    to: '/similar',
    icon: Sparkles,
    accent: 'from-glow/15',
  },
  {
    title: 'Compare two casinos',
    desc: 'Side-by-side features, signup requirements, and redeem options.',
    to: '/compare',
    icon: Scale,
    accent: 'from-brand/15',
  },
  {
    title: 'Roll a random pick',
    desc: 'Same logic as Discord /random — filter by VPN, slots, email-only, and more.',
    to: '/random',
    icon: Shuffle,
    accent: 'from-amber-500/10',
  },
];

export default function CatalogHelp() {
  usePageTitle('Catalog Help — The Method Casinos');
  const { user } = useAuth();

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Catalog Help"
        subtitle="Workflows for browsing, signing up safely, and expanding the verified database"
        icon={<BookOpen className="w-6 h-6 text-glow" />}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-glow p-5 mb-8 border-glow/20 text-sm text-gray-400"
      >
        <p>
          The Method is a professional sweepstakes catalog — not a listicle site. Every verified operator was reviewed by an admin.
          Use the tools below in order when onboarding a new platform.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {workflows.map(({ title, desc, to, icon: Icon, accent }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={to}
              className={`glass-glow p-5 h-full block card-shine bg-gradient-to-br ${accent} to-transparent hover:border-glow/35 transition-all group`}
            >
              <div className="p-2.5 rounded-lg bg-surface-overlay/80 border border-surface-border w-fit mb-3 group-hover:border-glow/30 transition-colors">
                <Icon className="w-5 h-5 text-glow" />
              </div>
              <h3 className="font-display font-semibold mb-1.5 group-hover:text-glow transition-colors">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border-gradient rounded-2xl p-6">
          <Heart className="w-6 h-6 text-rose-400 mb-3" />
          <h3 className="font-display font-semibold text-white mb-2">Save favorites</h3>
          <p className="text-sm text-gray-500 mb-4">
            Sign in with Discord to build My List — export your saved operators anytime.
          </p>
          {user ? (
            <Link to="/mylist" className="btn-glow text-sm inline-flex items-center gap-1">
              Open My List <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Link to="/login?next=/mylist" className="btn-glow text-sm">Sign in</Link>
          )}
        </div>

        <div className="border-gradient rounded-2xl p-6">
          <Radar className="w-6 h-6 text-glow mb-3" />
          <h3 className="font-display font-semibold text-white mb-2">Expand the catalog</h3>
          <p className="text-sm text-gray-500 mb-4">
            Admins run browser-based discovery scans and approve new operators in the review queue.
          </p>
          {user?.isAdmin ? (
            <Link to="/discovery" className="btn-primary text-sm inline-flex items-center gap-1">
              Open discovery <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Link to="/guides" className="btn-secondary text-sm">Read guides</Link>
          )}
        </div>
      </div>
    </div>
  );
}
