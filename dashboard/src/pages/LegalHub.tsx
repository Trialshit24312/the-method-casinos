import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScrollText, Shield, ShieldCheck, ExternalLink } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { usePageTitle } from '../hooks/usePageTitle';

const docs = [
  {
    to: '/terms',
    icon: ScrollText,
    title: 'Terms of Service',
    desc: 'Usage terms, disclaimers, and liability for the catalog, tools, and Discord bot.',
  },
  {
    to: '/rules',
    icon: Shield,
    title: 'Community Rules',
    desc: 'Standards for keeping casino data accurate and the community trustworthy.',
  },
  {
    to: '/privacy',
    icon: ShieldCheck,
    title: 'Privacy Policy',
    desc: 'What we collect via Discord OAuth, discovery logs, and user reports.',
  },
];

export default function LegalHub() {
  usePageTitle('Legal — The Method Casinos');

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <PageHeader
        icon={<ScrollText className="w-6 h-6 text-glow" />}
        title="Legal Hub"
        subtitle="Terms, community rules, and privacy — same documents linked from Discord /legal."
      />

      <div className="space-y-4">
        {docs.map((doc, i) => (
          <motion.div
            key={doc.to}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={doc.to}
              className="glass-glow p-5 flex items-start gap-4 hover:border-glow/30 transition-colors group"
            >
              <doc.icon className="w-8 h-8 text-glow shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-semibold text-lg group-hover:text-glow transition-colors flex items-center gap-2">
                  {doc.title}
                  <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60" />
                </h2>
                <p className="text-sm text-gray-500 mt-1">{doc.desc}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-8 text-center">
        In Discord use <code className="text-gray-400">/legal</code> for the same summaries with quick links.
      </p>
    </div>
  );
}
