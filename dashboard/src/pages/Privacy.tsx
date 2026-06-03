import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Breadcrumb from '../components/Breadcrumb';
import {
  PRIVACY_SECTIONS,
  LEGAL_LAST_UPDATED,
  LEGAL_VERSION,
} from '@shared/legal';

import { usePageTitle } from '../hooks/usePageTitle';

export default function PrivacyPage() {
  usePageTitle('Privacy Policy — The Method Casinos');
  return (
    <div className="page-container-legal">
      <Breadcrumb items={[{ label: 'Legal', to: '/legal' }, { label: 'Privacy' }]} />
      <PageHeader
        icon={<Lock className="w-6 h-6 text-glow" />}
        title="Privacy Policy"
        subtitle="How The Method Casinos handles your data"
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-glow p-6 mb-8 border-glow/20"
      >
        <p className="text-sm text-gray-400">
          Version {LEGAL_VERSION} · Last updated {LEGAL_LAST_UPDATED}. Also see{' '}
          <Link to="/terms" className="text-glow hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </motion.div>

      <div className="space-y-6">
        {PRIVACY_SECTIONS.map((section, i) => (
          <motion.section
            key={section.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-glow p-6"
          >
            <h3 className="font-display font-semibold text-lg text-white mb-3">{section.title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">{section.body}</p>
            <ul className="space-y-2">
              {section.bullets.map((b) => (
                <li key={b} className="text-sm text-gray-500 flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 text-glow shrink-0 mt-1" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </motion.section>
        ))}
      </div>
    </div>
  );
}
