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

export interface BlockedSiteInput {
  name: string;
  url: string;
  reason: BlockReason;
  severity?: BlockSeverity;
  description?: string;
  reportedBy?: string;
  removeCasino?: boolean;
}

export interface Trackable {
  label: string;
  value: number;
}

export type ReviewStatus = 'approved' | 'pending' | 'rejected';

export type CatalogHealthStatus = 'ok' | 'stale' | 'failed';

export interface Casino {
  id: string;
  name: string;
  url: string;
  urlNormalized: string;
  description: string;
  features: CasinoFeature[];
  signupRequirements: string[];
  bonusInfo: string;
  cashOutBeforeBlocked: number | null;
  trackables: Trackable[];
  rating: number;
  source: string;
  verified: boolean;
  reviewStatus: ReviewStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  lastCheckedAt: string | null;
  healthStatus: CatalogHealthStatus;
  healthNote: string;
}

export interface UrlCheckResult {
  url: string;
  blocked: boolean;
  blockedSite: BlockedSite | null;
  casino: Casino | null;
  safe: boolean;
  pendingReview?: boolean;
}

export interface CasinoInput {
  name: string;
  url: string;
  description?: string;
  features?: CasinoFeature[];
  signupRequirements?: string[];
  bonusInfo?: string;
  cashOutBeforeBlocked?: number | null;
  trackables?: Trackable[];
  rating?: number;
  source?: string;
  verified?: boolean;
  reviewStatus?: ReviewStatus;
}

export interface SearchFilters {
  query?: string;
  features?: CasinoFeature[];
  noPhone?: boolean;
  emailOnly?: boolean;
  verifiedOnly?: boolean;
  pendingOnly?: boolean;
  catalogOnly?: boolean;
  vpnAllowed?: boolean;
  limit?: number;
  offset?: number;
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

export type DiscoveryPhase = 'curated' | 'lists' | 'search' | 'analyze' | 'crawl';

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
  | { type: 'search_engine'; engine: 'serper' | 'duckduckgo' | 'duckduckgo_lite' | 'bing' | 'brave' | 'ddg_instant' | 'reddit' | 'browser'; query: string; linkCount?: number }
  | { type: 'url_scanning'; url: string }
  | { type: 'browser_fetch'; url: string }
  | { type: 'crawl_summary'; crawled: number; linksQueued: number; label: string }
  | { type: 'url_rejected'; url: string; reason: string }
  | { type: 'url_added'; url: string; name: string; needsReview?: boolean; reviewNote?: string }
  | { type: 'url_skipped'; url: string; reason: string }
  | { type: 'url_blocked'; url: string }
  | { type: 'heartbeat'; ts: number }
  | { type: 'complete'; result: DiscoveryResult };

export interface DiscoveryLiveSnapshot {
  running: boolean;
  mode: 'quick' | 'deep' | null;
  startedAt: number | null;
  phaseLabel: string;
  stats: DiscoveryLiveStats | null;
  events: Array<DiscoveryProgressEvent & { seq: number }>;
  lastSeq: number;
  result: DiscoveryResult | null;
}

export interface SiteReport {
  id: string;
  url: string;
  reason: string;
  reportedBy: string;
  status: 'open' | 'reviewed' | 'dismissed';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface SiteReportInput {
  url: string;
  reason?: string;
  reportedBy?: string;
}

export interface DashboardUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  isAdmin: boolean;
}

export interface Stats {
  totalCasinos: number;
  verifiedCasinos: number;
  pendingReview: number;
  openReports: number;
  noPhoneCasinos: number;
  emailOnlyCasinos: number;
  withSlots: number;
  withLiveGames: number;
  vpnAllowedCasinos: number;
  vpnBlockedCasinos: number;
  blockedSites: number;
  lastDiscoveryAt: string | null;
  staleCatalogCasinos: number;
  failedHealthCasinos: number;
}

export const ALL_FEATURES: CasinoFeature[] = [
  'no_phone',
  'email_only',
  'slots',
  'live_games',
  'sweepstakes',
  'table_games',
  'sports',
  'crypto',
  'instant_play',
  'vpn_allowed',
  'vpn_blocked',
  'geo_restricted',
  'no_kyc',
  'fast_payout',
  'daily_bonus',
  'referral_bonus',
  'low_min_redeem',
  'gift_card_redeem',
  'paypal_redeem',
  'bank_transfer',
  'mobile_app',
  'bingo',
  'fish_games',
  'poker',
  'wheel_spin',
  'no_deposit_bonus',
  'venmo_redeem',
  'apple_pay',
  'us_only',
  'new_casino',
  'progressive_jackpot',
  'social_features',
  'web_only',
  'cash_app',
  'zelle_redeem',
  'scratch_cards',
  'tournaments',
  'vip_program',
  'android_app',
  'ios_app',
  'plinko',
  'keno',
  'free_spins',
  'loyalty_program',
  'blackjack',
  'roulette',
  'crash_games',
  'megaways',
  'hold_and_win',
  'debit_card_redeem',
  'ach_redeem',
  'live_chat',
  'welcome_bonus',
  'signup_bonus',
  'no_wagering',
  'multi_state',
  'pragmatic_play',
];

export const BLOCK_REASONS: BlockReason[] = [
  'scam', 'phishing', 'malware', 'fake_casino', 'no_payout',
  'clone_site', 'deposit_fraud', 'spam', 'other',
];

export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  scam: 'Scam',
  phishing: 'Phishing',
  malware: 'Malware',
  fake_casino: 'Fake Casino',
  no_payout: 'No Payout / Won\'t Redeem',
  clone_site: 'Clone / Impersonator',
  deposit_fraud: 'Deposit Fraud',
  spam: 'Spam Site',
  other: 'Other',
};

export const BLOCK_SEVERITY_LABELS: Record<BlockSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const FEATURE_LABELS: Record<CasinoFeature, string> = {
  no_phone: 'No Phone Required',
  email_only: 'Email + Password Only',
  slots: 'Slots',
  live_games: 'Live Games',
  sweepstakes: 'Sweepstakes',
  table_games: 'Table Games',
  sports: 'Sports Betting',
  crypto: 'Crypto Accepted',
  instant_play: 'Instant Play',
  vpn_allowed: 'VPN Allowed',
  vpn_blocked: 'VPN Blocked',
  geo_restricted: 'Geo Restricted',
  no_kyc: 'No KYC',
  fast_payout: 'Fast Payout',
  daily_bonus: 'Daily Bonus',
  referral_bonus: 'Referral Bonus',
  low_min_redeem: 'Low Min Redeem',
  gift_card_redeem: 'Gift Card Redeem',
  paypal_redeem: 'PayPal Redeem',
  bank_transfer: 'Bank Transfer',
  mobile_app: 'Mobile App',
  bingo: 'Bingo',
  fish_games: 'Fish Games',
  poker: 'Poker',
  wheel_spin: 'Wheel / Spin',
  no_deposit_bonus: 'No Deposit Bonus',
  venmo_redeem: 'Venmo Redeem',
  apple_pay: 'Apple Pay',
  us_only: 'US Only',
  new_casino: 'New Casino',
  progressive_jackpot: 'Progressive Jackpot',
  social_features: 'Social Features',
  web_only: 'Web Only',
  cash_app: 'Cash App Redeem',
  zelle_redeem: 'Zelle Redeem',
  scratch_cards: 'Scratch Cards',
  tournaments: 'Tournaments',
  vip_program: 'VIP Program',
  android_app: 'Android App',
  ios_app: 'iOS App',
  plinko: 'Plinko',
  keno: 'Keno',
  free_spins: 'Free Spins',
  loyalty_program: 'Loyalty Program',
  blackjack: 'Blackjack',
  roulette: 'Roulette',
  crash_games: 'Crash Games',
  megaways: 'Megaways',
  hold_and_win: 'Hold & Win',
  debit_card_redeem: 'Debit Card Redeem',
  ach_redeem: 'ACH / Bank Redeem',
  live_chat: 'Live Chat Support',
  welcome_bonus: 'Welcome Bonus',
  signup_bonus: 'Signup Bonus',
  no_wagering: 'No Wagering',
  multi_state: 'Multi-State Available',
  pragmatic_play: 'Pragmatic Play',
};

export const FEATURE_EMOJI: Record<CasinoFeature, string> = {
  no_phone: '📵',
  email_only: '✉️',
  slots: '🎰',
  live_games: '🎲',
  sweepstakes: '🎁',
  table_games: '♠️',
  sports: '🏈',
  crypto: '₿',
  instant_play: '⚡',
  vpn_allowed: '🛡️',
  vpn_blocked: '🚫',
  geo_restricted: '🌍',
  no_kyc: '🪪',
  fast_payout: '⚡',
  daily_bonus: '📅',
  referral_bonus: '👥',
  low_min_redeem: '💵',
  gift_card_redeem: '🎁',
  paypal_redeem: '💳',
  bank_transfer: '🏦',
  mobile_app: '📱',
  bingo: '🎯',
  fish_games: '🐟',
  poker: '♣️',
  wheel_spin: '🎡',
  no_deposit_bonus: '🆓',
  venmo_redeem: '💸',
  apple_pay: '🍎',
  us_only: '🇺🇸',
  new_casino: '✨',
  progressive_jackpot: '💰',
  social_features: '👥',
  web_only: '🌐',
  cash_app: '💵',
  zelle_redeem: '💳',
  scratch_cards: '🎫',
  tournaments: '🏆',
  vip_program: '👑',
  android_app: '🤖',
  ios_app: '🍏',
  plinko: '🎯',
  keno: '🎱',
  free_spins: '🔄',
  loyalty_program: '⭐',
  blackjack: '🃏',
  roulette: '🔴',
  crash_games: '📈',
  megaways: '🎰',
  hold_and_win: '💎',
  debit_card_redeem: '💳',
  ach_redeem: '🏦',
  live_chat: '💬',
  welcome_bonus: '🎉',
  signup_bonus: '🆕',
  no_wagering: '✅',
  multi_state: '🗺️',
  pragmatic_play: '🎰',
};
