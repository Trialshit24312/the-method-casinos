export interface SubscriptionTierData {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  emoji: string;
  highlighted?: boolean;
  perks: string[];
  summary: string;
}

/** Preview pricing — subscriptions not purchasable until launch. */
export const SUBSCRIPTIONS_LAUNCHING = true;

export const SUBSCRIPTION_TIERS: SubscriptionTierData[] = [
  {
    id: 'scout',
    name: 'Scout',
    tagline: 'Learn the landscape',
    priceMonthly: 7,
    emoji: '🧭',
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
    emoji: '🎯',
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
    emoji: '📊',
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
    emoji: '👑',
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

export function formatTierPerks(perks: string[], max = 6): string {
  return perks.slice(0, max).map((p) => `• ${p}`).join('\n');
}
