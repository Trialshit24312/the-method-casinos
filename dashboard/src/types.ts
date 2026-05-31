export type CasinoFeature =
  | 'no_phone'
  | 'email_only'
  | 'slots'
  | 'live_games'
  | 'sweepstakes'
  | 'table_games'
  | 'sports'
  | 'crypto'
  | 'instant_play'
  | 'vpn_allowed'
  | 'vpn_blocked'
  | 'geo_restricted'
  | 'no_kyc'
  | 'fast_payout'
  | 'daily_bonus'
  | 'referral_bonus'
  | 'low_min_redeem'
  | 'gift_card_redeem'
  | 'paypal_redeem'
  | 'bank_transfer'
  | 'mobile_app'
  | 'bingo'
  | 'fish_games'
  | 'poker'
  | 'wheel_spin'
  | 'no_deposit_bonus'
  | 'venmo_redeem'
  | 'apple_pay'
  | 'us_only'
  | 'new_casino'
  | 'progressive_jackpot'
  | 'social_features'
  | 'web_only'
  | 'cash_app'
  | 'zelle_redeem'
  | 'scratch_cards'
  | 'tournaments'
  | 'vip_program'
  | 'android_app'
  | 'ios_app'
  | 'plinko'
  | 'keno'
  | 'free_spins'
  | 'loyalty_program'
  | 'blackjack'
  | 'roulette'
  | 'crash_games'
  | 'megaways'
  | 'hold_and_win'
  | 'debit_card_redeem'
  | 'ach_redeem'
  | 'live_chat'
  | 'welcome_bonus'
  | 'signup_bonus'
  | 'no_wagering'
  | 'multi_state'
  | 'pragmatic_play';

export type BlockReason =
  | 'scam'
  | 'phishing'
  | 'malware'
  | 'fake_casino'
  | 'no_payout'
  | 'clone_site'
  | 'deposit_fraud'
  | 'spam'
  | 'other';

export type BlockSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Trackable {
  label: string;
  value: number;
}

export interface Casino {
  id: string;
  name: string;
  url: string;
  description: string;
  features: CasinoFeature[];
  signupRequirements: string[];
  bonusInfo: string;
  cashOutBeforeBlocked: number | null;
  trackables: Trackable[];
  rating: number;
  source: string;
  verified: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlockedSite {
  id: string;
  name: string;
  url: string;
  urlNormalized: string;
  reason: BlockReason;
  severity: BlockSeverity;
  description: string;
  reportedBy: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  totalCasinos: number;
  verifiedCasinos: number;
  noPhoneCasinos: number;
  emailOnlyCasinos: number;
  withSlots: number;
  withLiveGames: number;
  vpnAllowedCasinos: number;
  vpnBlockedCasinos: number;
  blockedSites: number;
  lastDiscoveryAt: string | null;
}

export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  avatarUrl: string;
  isAdmin: boolean;
}

export interface DiscoveryResult {
  scanned: number;
  found: number;
  added: number;
  skipped: number;
  blocked: number;
  rejected: number;
  durationMs: number;
  sourcesChecked: number;
  errors: string[];
  mode: 'quick' | 'deep';
  addedCasinos: { name: string; url: string }[];
}

export type DiscoveryPhase = 'curated' | 'search' | 'analyze' | 'crawl';

export interface DiscoveryLiveStats {
  scanned: number;
  queued: number;
  added: number;
  rejected: number;
  skipped: number;
  blocked: number;
  sourcesChecked: number;
  phase: DiscoveryPhase;
  queryIndex: number;
  queryTotal: number;
}

export type DiscoveryProgressEvent =
  | { type: 'phase'; phase: DiscoveryPhase; label: string }
  | { type: 'progress'; stats: DiscoveryLiveStats }
  | { type: 'search_query'; query: string }
  | { type: 'search_engine'; engine: 'duckduckgo' | 'bing'; query: string }
  | { type: 'url_scanning'; url: string }
  | { type: 'url_rejected'; url: string; reason: string }
  | { type: 'url_added'; url: string; name: string }
  | { type: 'url_skipped'; url: string; reason: string }
  | { type: 'url_blocked'; url: string }
  | { type: 'complete'; result: DiscoveryResult };

export interface UrlCheckResult {
  url: string;
  blocked: boolean;
  blockedSite: BlockedSite | null;
  casino: Casino | null;
  safe: boolean;
}

export interface SimilarCasinoMatch {
  casino: Casino;
  score: number;
  matchPercent: number;
  sharedFeatures: CasinoFeature[];
  reasons: string[];
}

export interface SimilarCasinosResult {
  source: Casino;
  matches: SimilarCasinoMatch[];
}

export const FEATURE_LABELS: Record<CasinoFeature, string> = {
  no_phone: 'No Phone',
  email_only: 'Email Only',
  slots: 'Slots',
  live_games: 'Live Games',
  sweepstakes: 'Sweepstakes',
  table_games: 'Table Games',
  sports: 'Sports',
  crypto: 'Crypto',
  instant_play: 'Instant Play',
  vpn_allowed: 'VPN Allowed',
  vpn_blocked: 'VPN Blocked',
  geo_restricted: 'Geo Restricted',
  no_kyc: 'No KYC',
  fast_payout: 'Fast Payout',
  daily_bonus: 'Daily Bonus',
  referral_bonus: 'Referral Bonus',
  low_min_redeem: 'Low Min Redeem',
  gift_card_redeem: 'Gift Card',
  paypal_redeem: 'PayPal',
  bank_transfer: 'Bank Transfer',
  mobile_app: 'Mobile App',
  bingo: 'Bingo',
  fish_games: 'Fish Games',
  poker: 'Poker',
  wheel_spin: 'Wheel / Spin',
  no_deposit_bonus: 'No Deposit Bonus',
  venmo_redeem: 'Venmo',
  apple_pay: 'Apple Pay',
  us_only: 'US Only',
  new_casino: 'New Casino',
  progressive_jackpot: 'Progressive Jackpot',
  social_features: 'Social',
  web_only: 'Web Only',
  cash_app: 'Cash App',
  zelle_redeem: 'Zelle',
  scratch_cards: 'Scratch Cards',
  tournaments: 'Tournaments',
  vip_program: 'VIP',
  android_app: 'Android',
  ios_app: 'iOS',
  plinko: 'Plinko',
  keno: 'Keno',
  free_spins: 'Free Spins',
  loyalty_program: 'Loyalty',
  blackjack: 'Blackjack',
  roulette: 'Roulette',
  crash_games: 'Crash',
  megaways: 'Megaways',
  hold_and_win: 'Hold & Win',
  debit_card_redeem: 'Debit Card',
  ach_redeem: 'ACH Redeem',
  live_chat: 'Live Chat',
  welcome_bonus: 'Welcome Bonus',
  signup_bonus: 'Signup Bonus',
  no_wagering: 'No Wagering',
  multi_state: 'Multi-State',
  pragmatic_play: 'Pragmatic Play',
};

export const FEATURE_COLORS: Record<CasinoFeature, string> = {
  no_phone: 'bg-blue-500/20 text-blue-300',
  email_only: 'bg-purple-500/20 text-purple-300',
  slots: 'bg-yellow-500/20 text-yellow-300',
  live_games: 'bg-red-500/20 text-red-300',
  sweepstakes: 'bg-green-500/20 text-green-300',
  table_games: 'bg-orange-500/20 text-orange-300',
  sports: 'bg-teal-500/20 text-teal-300',
  crypto: 'bg-amber-500/20 text-amber-300',
  instant_play: 'bg-pink-500/20 text-pink-300',
  vpn_allowed: 'bg-emerald-500/20 text-emerald-300',
  vpn_blocked: 'bg-rose-500/20 text-rose-300',
  geo_restricted: 'bg-cyan-500/20 text-cyan-300',
  no_kyc: 'bg-indigo-500/20 text-indigo-300',
  fast_payout: 'bg-lime-500/20 text-lime-300',
  daily_bonus: 'bg-sky-500/20 text-sky-300',
  referral_bonus: 'bg-violet-500/20 text-violet-300',
  low_min_redeem: 'bg-emerald-500/20 text-emerald-300',
  gift_card_redeem: 'bg-fuchsia-500/20 text-fuchsia-300',
  paypal_redeem: 'bg-blue-500/20 text-blue-300',
  bank_transfer: 'bg-slate-500/20 text-slate-300',
  mobile_app: 'bg-orange-500/20 text-orange-300',
  bingo: 'bg-pink-500/20 text-pink-300',
  fish_games: 'bg-cyan-500/20 text-cyan-300',
  poker: 'bg-indigo-500/20 text-indigo-300',
  wheel_spin: 'bg-amber-500/20 text-amber-300',
  no_deposit_bonus: 'bg-lime-500/20 text-lime-300',
  venmo_redeem: 'bg-blue-500/20 text-blue-300',
  apple_pay: 'bg-gray-500/20 text-gray-300',
  us_only: 'bg-red-500/20 text-red-300',
  new_casino: 'bg-violet-500/20 text-violet-300',
  progressive_jackpot: 'bg-yellow-500/20 text-yellow-300',
  social_features: 'bg-teal-500/20 text-teal-300',
  web_only: 'bg-slate-500/20 text-slate-300',
  cash_app: 'bg-green-500/20 text-green-300',
  zelle_redeem: 'bg-purple-500/20 text-purple-300',
  scratch_cards: 'bg-orange-500/20 text-orange-300',
  tournaments: 'bg-yellow-500/20 text-yellow-300',
  vip_program: 'bg-amber-500/20 text-amber-300',
  android_app: 'bg-lime-500/20 text-lime-300',
  ios_app: 'bg-gray-500/20 text-gray-300',
  plinko: 'bg-pink-500/20 text-pink-300',
  keno: 'bg-indigo-500/20 text-indigo-300',
  free_spins: 'bg-cyan-500/20 text-cyan-300',
  loyalty_program: 'bg-amber-500/20 text-amber-300',
  blackjack: 'bg-red-500/20 text-red-300',
  roulette: 'bg-rose-500/20 text-rose-300',
  crash_games: 'bg-violet-500/20 text-violet-300',
  megaways: 'bg-yellow-500/20 text-yellow-300',
  hold_and_win: 'bg-emerald-500/20 text-emerald-300',
  debit_card_redeem: 'bg-blue-500/20 text-blue-300',
  ach_redeem: 'bg-slate-500/20 text-slate-300',
  live_chat: 'bg-sky-500/20 text-sky-300',
  welcome_bonus: 'bg-emerald-500/20 text-emerald-300',
  signup_bonus: 'bg-lime-500/20 text-lime-300',
  no_wagering: 'bg-green-500/20 text-green-300',
  multi_state: 'bg-indigo-500/20 text-indigo-300',
  pragmatic_play: 'bg-orange-500/20 text-orange-300',
};

export const ALL_FEATURES: CasinoFeature[] = Object.keys(FEATURE_LABELS) as CasinoFeature[];

export const FEATURE_CATEGORIES: { label: string; features: CasinoFeature[] }[] = [
  {
    label: 'Signup & Access',
    features: ['no_phone', 'email_only', 'no_kyc', 'instant_play', 'us_only', 'new_casino', 'web_only'],
  },
  {
    label: 'Games',
    features: [
      'slots', 'live_games', 'table_games', 'sports', 'bingo', 'fish_games', 'poker',
      'wheel_spin', 'scratch_cards', 'plinko', 'keno', 'blackjack', 'roulette',
      'crash_games', 'megaways', 'hold_and_win', 'progressive_jackpot', 'pragmatic_play',
    ],
  },
  {
    label: 'VPN & Region',
    features: ['vpn_allowed', 'vpn_blocked', 'geo_restricted', 'multi_state'],
  },
  {
    label: 'Bonuses & Rewards',
    features: ['daily_bonus', 'referral_bonus', 'no_deposit_bonus', 'free_spins', 'tournaments', 'vip_program', 'loyalty_program', 'welcome_bonus', 'signup_bonus', 'no_wagering'],
  },
  {
    label: 'Redemption',
    features: [
      'fast_payout', 'low_min_redeem', 'gift_card_redeem', 'paypal_redeem', 'bank_transfer',
      'venmo_redeem', 'apple_pay', 'cash_app', 'zelle_redeem', 'debit_card_redeem', 'ach_redeem', 'crypto',
    ],
  },
  {
    label: 'Platform & Support',
    features: ['mobile_app', 'android_app', 'ios_app', 'social_features', 'live_chat', 'sweepstakes'],
  },
];

export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  scam: 'Scam',
  phishing: 'Phishing',
  malware: 'Malware',
  fake_casino: 'Fake Casino',
  no_payout: 'No Payout',
  clone_site: 'Clone Site',
  deposit_fraud: 'Deposit Fraud',
  spam: 'Spam',
  other: 'Other',
};

export const BLOCK_SEVERITY_COLORS: Record<BlockSeverity, string> = {
  low: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export function vpnLabel(features: CasinoFeature[]): string {
  if (features.includes('vpn_blocked')) return 'VPN Blocked';
  if (features.includes('vpn_allowed')) return 'VPN Allowed';
  return 'VPN Unknown';
}

export function formatTrackableValue(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
