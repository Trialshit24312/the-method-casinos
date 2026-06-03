import type { LucideIcon } from 'lucide-react';
import { Compass, Crosshair, Target, Crown } from 'lucide-react';
import {
  SUBSCRIPTION_TIERS as SHARED_TIERS,
  SUBSCRIPTIONS_LAUNCHING,
  formatTierPrice,
  type SubscriptionTierData,
} from '@shared/subscription-tiers.js';

export { SUBSCRIPTIONS_LAUNCHING, formatTierPrice };
export type { SubscriptionTierData };

const TIER_ICONS: Record<string, LucideIcon> = {
  scout: Compass,
  operator: Crosshair,
  strategist: Target,
  architect: Crown,
};

const TIER_STYLES: Record<string, { accent: string; borderAccent: string; glowClass: string }> = {
  scout: { accent: 'text-gray-300', borderAccent: 'border-white/10', glowClass: 'from-white/5 to-transparent' },
  operator: { accent: 'text-glow', borderAccent: 'border-glow/25', glowClass: 'from-glow/10 to-transparent' },
  strategist: { accent: 'text-brand-light', borderAccent: 'border-brand/40', glowClass: 'from-brand/15 to-transparent' },
  architect: { accent: 'text-amber-300', borderAccent: 'border-amber-500/35', glowClass: 'from-amber-500/15 to-transparent' },
};

export interface SubscriptionTier extends SubscriptionTierData {
  icon: LucideIcon;
  accent: string;
  borderAccent: string;
  glowClass: string;
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = SHARED_TIERS.map((tier) => ({
  ...tier,
  icon: TIER_ICONS[tier.id] ?? Compass,
  ...TIER_STYLES[tier.id],
}));
