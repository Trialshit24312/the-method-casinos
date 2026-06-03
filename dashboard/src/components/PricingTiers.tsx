import { motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import {
  SUBSCRIPTION_TIERS,
  SUBSCRIPTIONS_LAUNCHING,
  formatTierPrice,
  type SubscriptionTier,
} from '../lib/subscription-tiers';

interface Props {
  compact?: boolean;
  showHeader?: boolean;
}

function TierCard({ tier, index, compact }: { tier: SubscriptionTier; index: number; compact?: boolean }) {
  const Icon = tier.icon;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`relative flex flex-col rounded-2xl border bg-surface-raised/60 backdrop-blur-xl overflow-hidden card-shine ${
        tier.highlighted
          ? 'border-brand/50 shadow-[0_0_40px_rgba(184,115,51,0.12)] scale-[1.02] z-10'
          : tier.borderAccent
      } ${compact ? 'p-5' : 'p-6 md:p-7'}`}
    >
      {tier.highlighted && (
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand via-glow to-brand" />
      )}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${tier.glowClass} pointer-events-none opacity-80`}
        aria-hidden
      />

      <div className="relative">
        {tier.highlighted && (
          <span className="inline-block text-[10px] uppercase tracking-widest font-semibold text-brand-light mb-3 px-2 py-0.5 rounded-full bg-brand/15 border border-brand/30">
            Most popular
          </span>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2.5 rounded-xl bg-white/5 border ${tier.borderAccent}`}>
            <Icon className={`w-5 h-5 ${tier.accent}`} />
          </div>
          <div>
            <h3 className="font-display font-bold text-xl text-white">{tier.name}</h3>
            <p className="text-xs text-gray-500">{tier.tagline}</p>
          </div>
        </div>

        <div className="mb-5">
          <p className="flex items-baseline gap-1">
            <span className="font-display text-4xl font-bold text-white">{formatTierPrice(tier.priceMonthly)}</span>
            <span className="text-sm text-gray-500">/ month</span>
          </p>
          {!compact && <p className="text-xs text-gray-600 mt-1">{tier.summary}</p>}
        </div>

        <ul className={`space-y-2.5 mb-6 flex-1 ${compact ? 'text-xs' : 'text-sm'}`}>
          {tier.perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2.5 text-gray-400">
              <Check className={`w-4 h-4 shrink-0 mt-0.5 ${tier.accent}`} aria-hidden />
              <span>{perk}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled
          title="Subscriptions are not available yet"
          className={`w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-not-allowed opacity-60 ${
            tier.highlighted
              ? 'bg-brand/20 border border-brand/40 text-brand-light'
              : 'bg-white/[0.04] border border-white/10 text-gray-400'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          Subscribe soon
        </button>
      </div>
    </motion.article>
  );
}

export default function PricingTiers({ compact = false, showHeader = true }: Props) {
  return (
    <div>
      {showHeader && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10 md:mb-12"
        >
          {SUBSCRIPTIONS_LAUNCHING && (
            <div className="inline-flex items-center gap-2 pro-badge mb-4">
              <Lock className="w-3.5 h-3.5" />
              Preview pricing — subscriptions launching soon
            </div>
          )}
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
            Choose your <span className="text-gradient-brand">Method</span>
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            Four tiers built for how deep you want to go — from catalog browsing to full operator intel.
            Perks stack as you move up. Billing is not live yet.
          </p>
        </motion.div>
      )}

      <div className={`grid gap-5 ${compact ? 'sm:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
        {SUBSCRIPTION_TIERS.map((tier, i) => (
          <TierCard key={tier.id} tier={tier} index={i} compact={compact} />
        ))}
      </div>

      <p className="text-center text-xs text-gray-600 mt-8 max-w-2xl mx-auto leading-relaxed">
        All tiers are monthly subscriptions shown for planning purposes only.
        You cannot purchase yet — we&apos;ll enable checkout when the platform is ready.
        Current free features remain available while we finalize tiers.
      </p>
    </div>
  );
}
