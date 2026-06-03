import type { LucideIcon } from 'lucide-react';
import { Compass, Crosshair, Target, Crown } from 'lucide-react';

export interface SubscriptionTier {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  icon: LucideIcon;
  accent: string;
  borderAccent: string;
  glowClass: string;
  highlighted?: boolean;
  perks: string[];
  /** Short label for compact cards */
  summary: string;
}

/** Preview pricing — subscriptions not purchasable until launch. */
export const SUBSCRIPTIONS_LAUNCHING = true;

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'scout',
    name: 'Scout',
    tagline: 'Learn the landscape',
    priceMonthly: 7,
    icon: Compass,
    accent: 'text-gray-300',
    borderAccent: 'border-white/10',
    glowClass: 'from-white/5 to-transparent',
    summary: 'Catalog access, favorites, and safety basics',
    perks: [
      'Full verified casino catalog + search',
      'My List — save and track favorites',
      'Side-by-side compare (2 casinos)',
      'Basic URL safety checker',
      'Public Discord community access',
    ],
  },
  {
    id: 'operator',
    name: 'Operator',
    tagline: 'Run your workflow',
    priceMonthly: 15,
    icon: Crosshair,
    accent: 'text-glow',
    borderAccent: 'border-glow/25',
    glowClass: 'from-glow/10 to-transparent',
    summary: 'Tools, filters, and similar-casino discovery',
    perks: [
      'Everything in Scout',
      'Similar-casino matcher + web search',
      'Signup tools — email, phone, password',
      'Advanced filters (VPN, redeem, slots, email-only)',
      'Full Method Guides library',
      'Operator Discord channel',
    ],
  },
  {
    id: 'strategist',
    name: 'Strategist',
    tagline: 'Stay ahead of the catalog',
    priceMonthly: 29,
    icon: Target,
    accent: 'text-brand-light',
    borderAccent: 'border-brand/40',
    glowClass: 'from-brand/15 to-transparent',
    highlighted: true,
    summary: 'Early access, alerts, and unlimited checks',
    perks: [
      'Everything in Operator',
      'Unlimited URL checks + priority blocklist sync',
      'Early access to newly discovered casinos',
      'Custom Discord alerts (no-phone, VPN-friendly, etc.)',
      'Export compare & research reports',
      'Strategist Discord lounge',
    ],
  },
  {
    id: 'architect',
    name: 'Architect',
    tagline: 'Full Method access',
    priceMonthly: 59,
    icon: Crown,
    accent: 'text-amber-300',
    borderAccent: 'border-amber-500/35',
    glowClass: 'from-amber-500/15 to-transparent',
    summary: 'Beta features, priority support, curated intel',
    perks: [
      'Everything in Strategist',
      'Private Architect Discord lounge',
      'Beta dashboard features first',
      'API access when available',
      'Monthly curated operator picks brief',
      'Priority scam URL review & catalog requests',
      'Direct feedback line to the team',
    ],
  },
];

export function formatTierPrice(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}
