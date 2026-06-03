import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, ArrowRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Breadcrumb from '../components/Breadcrumb';
import PricingTiers from '../components/PricingTiers';
import { usePageTitle } from '../hooks/usePageTitle';
import { discordInviteUrl } from '../lib/site';

export default function Pricing() {
  usePageTitle('Membership — The Method Casinos');
  const discordInvite = discordInviteUrl();

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: 'Membership' }]} />
      <PageHeader
        icon={<Crown className="w-6 h-6 text-brand-light" />}
        title="Membership tiers"
        subtitle="Monthly subscriptions with stacked perks — Scout through Architect. Preview the lineup before we turn on billing."
        badge={(
          <span className="pro-badge">
            <Crown className="w-3.5 h-3.5" />
            Coming soon · No checkout yet
          </span>
        )}
      />

      <PricingTiers showHeader={false} />

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-14 glass-glow p-6 md:p-8 border-gradient"
      >
        <h2 className="font-display font-semibold text-lg text-white mb-4">How tiers work</h2>
        <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-400 animate-stagger">
          <div>
            <p className="text-white font-medium mb-1">Stacked perks</p>
            <p>Each tier includes everything from the tiers below it. Operator gets Scout perks plus more — Strategist adds on Operator, and so on.</p>
          </div>
          <div>
            <p className="text-white font-medium mb-1">Monthly billing</p>
            <p>All four tiers are billed monthly when subscriptions go live. Cancel anytime — no annual lock-in required at launch.</p>
          </div>
          <div>
            <p className="text-white font-medium mb-1">Free access today</p>
            <p>The catalog, tools, and Discord community stay available while we finish membership. Paid tiers unlock premium workflows when ready.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-white/10">
          <Link to="/casinos" className="btn-primary inline-flex items-center gap-2 text-sm">
            Browse catalog <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/dashboard" className="btn-secondary inline-flex items-center gap-2 text-sm">
            Go to dashboard
          </Link>
          {discordInvite && (
            <a
              href={discordInvite}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-discord/40 text-discord hover:bg-discord/10 transition-colors"
            >
              Join Discord for launch updates
            </a>
          )}
        </div>
      </motion.section>
    </div>
  );
}
