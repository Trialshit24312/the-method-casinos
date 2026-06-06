import type { Casino, CasinoFeature } from './types.js';

export interface SimilarCasinoMatch {
  casino: Casino;
  score: number;
  matchPercent: number;
  sharedFeatures: CasinoFeature[];
  reasons: string[];
  /** 0–100 feature-vector overlap (excludes universal tags). */
  featurePercent?: number;
  /** 0–100 text overlap on name/description/bonus. */
  textPercent?: number;
}

const FEATURE_WEIGHTS: Partial<Record<CasinoFeature, number>> = {
  no_phone: 4,
  email_only: 3.5,
  slots: 3,
  live_games: 3,
  sweepstakes: 1.5,
  table_games: 2.5,
  sports: 2.5,
  fish_games: 3,
  bingo: 2.5,
  poker: 2.5,
  vpn_allowed: 3,
  vpn_blocked: 3,
  geo_restricted: 2,
  no_kyc: 2.5,
  fast_payout: 2.5,
  low_min_redeem: 2.5,
  daily_bonus: 2,
  instant_play: 1.5,
  gift_card_redeem: 2.5,
  paypal_redeem: 2.5,
  venmo_redeem: 2.5,
  cash_app: 2.5,
  zelle_redeem: 2,
  apple_pay: 2,
  bank_transfer: 2,
  debit_card_redeem: 2,
  ach_redeem: 2,
  mobile_app: 2,
  android_app: 2,
  ios_app: 2,
  new_casino: 1.5,
  progressive_jackpot: 2,
  megaways: 2.5,
  plinko: 2.5,
  crash_games: 2.5,
  free_spins: 2,
  welcome_bonus: 2,
  signup_bonus: 2,
  no_wagering: 2.5,
  no_deposit_bonus: 2,
  pragmatic_play: 3,
  crypto: 2,
  wheel_spin: 2,
  hold_and_win: 2,
  blackjack: 2,
  roulette: 2,
  keno: 2,
  scratch_cards: 2,
  tournaments: 2,
  vip_program: 2,
  loyalty_program: 2,
  referral_bonus: 2,
  live_chat: 1.5,
  multi_state: 2,
  us_only: 2,
  social_features: 1.5,
  web_only: 1,
};

/** Tags almost every operator shares — weak alone as discriminators. */
const UNIVERSAL_FEATURES = new Set<CasinoFeature>([
  'sweepstakes',
  'instant_play',
  'web_only',
  'daily_bonus',
]);

const VPN_FEATURES: CasinoFeature[] = ['vpn_allowed', 'vpn_blocked', 'geo_restricted'];

const REDEEM_FEATURES: CasinoFeature[] = [
  'gift_card_redeem', 'paypal_redeem', 'venmo_redeem', 'cash_app', 'zelle_redeem',
  'apple_pay', 'bank_transfer', 'debit_card_redeem', 'ach_redeem', 'fast_payout', 'low_min_redeem',
];

const GAME_FEATURES: CasinoFeature[] = [
  'slots', 'live_games', 'fish_games', 'table_games', 'bingo', 'poker', 'plinko',
  'crash_games', 'keno', 'scratch_cards', 'blackjack', 'roulette', 'wheel_spin', 'megaways',
];

const TEXT_STOP = new Set([
  'the', 'and', 'for', 'with', 'casino', 'online', 'play', 'free', 'your', 'get', 'new',
  'best', 'top', 'site', 'sites', 'game', 'games', 'bonus', 'welcome', 'sign', 'join',
]);

function featureWeight(feature: CasinoFeature): number {
  return FEATURE_WEIGHTS[feature] ?? 1.25;
}

function vpnProfile(features: CasinoFeature[]): string {
  if (features.includes('vpn_blocked')) return 'blocked';
  if (features.includes('vpn_allowed')) return 'allowed';
  if (features.includes('geo_restricted')) return 'geo';
  return 'unknown';
}

function normalizeSignupTags(reqs: string[]): string[] {
  const tags = new Set<string>();
  for (const req of reqs) {
    const l = req.toLowerCase();
    if (l.includes('email')) tags.add('email');
    if (l.includes('phone') || l.includes('sms')) tags.add('phone');
    if (l.includes('id') || l.includes('verify') || l.includes('kyc')) tags.add('id');
    if (l.includes('facebook') || l.includes('google') || l.includes('social')) tags.add('social');
    if (l.includes('address')) tags.add('address');
  }
  return [...tags].sort();
}

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)) {
    const t = raw.replace(/^-+|-+$/g, '');
    if (t.length >= 3 && !TEXT_STOP.has(t)) tokens.add(t);
  }
  return tokens;
}

function computeTextSimilarity(source: Casino, candidate: Casino): number {
  const sourceText = `${source.name} ${source.description} ${source.bonusInfo}`;
  const candidateText = `${candidate.name} ${candidate.description} ${candidate.bonusInfo}`;
  const a = tokenize(sourceText);
  const b = tokenize(candidateText);
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = new Set([...a, ...b]).size;
  let score = union > 0 ? intersection / union : 0;

  const sourceBrand = tokenize(source.name.replace(/\s+casino$/i, ''));
  const candidateBrand = tokenize(candidate.name.replace(/\s+casino$/i, ''));
  for (const t of sourceBrand) {
    if (candidateBrand.has(t)) score += 0.08;
  }

  return Math.min(1, score);
}

function distinguishingFeatures(features: CasinoFeature[]): CasinoFeature[] {
  return features.filter((f) => !UNIVERSAL_FEATURES.has(f));
}

function weightedFeatureJaccard(
  sourceFeatures: CasinoFeature[],
  candidateFeatures: CasinoFeature[],
): { ratio: number; shared: CasinoFeature[] } {
  const source = new Set(distinguishingFeatures(sourceFeatures));
  const candidate = new Set(distinguishingFeatures(candidateFeatures));
  const union = new Set([...source, ...candidate]);

  if (union.size === 0) {
    const sharedUniversal = sourceFeatures.filter((f) => candidateFeatures.includes(f));
    return { ratio: sharedUniversal.length > 0 ? 0.25 : 0, shared: sharedUniversal };
  }

  let intersectionWeight = 0;
  let unionWeight = 0;
  const shared: CasinoFeature[] = [];

  for (const feature of union) {
    const weight = featureWeight(feature);
    unionWeight += weight;
    if (source.has(feature) && candidate.has(feature)) {
      intersectionWeight += weight;
      shared.push(feature);
    }
  }

  return {
    ratio: unionWeight > 0 ? intersectionWeight / unionWeight : 0,
    shared,
  };
}

function buildReasons(
  sharedFeatures: CasinoFeature[],
  source: Casino,
  candidate: Casino,
  sourceVpn: string,
  candidateVpn: string,
  textPct: number,
): string[] {
  const reasons: string[] = [];

  if (sharedFeatures.includes('no_phone')) reasons.push('No phone required');
  if (sharedFeatures.includes('email_only')) reasons.push('Email-only signup');
  if (GAME_FEATURES.filter((f) => sharedFeatures.includes(f)).length >= 2) reasons.push('Similar game mix');
  else if (sharedFeatures.includes('slots')) reasons.push('Slots');
  else if (sharedFeatures.includes('live_games')) reasons.push('Live games');
  else if (sharedFeatures.includes('fish_games')) reasons.push('Fish games');

  if (sourceVpn !== 'unknown' && sourceVpn === candidateVpn) {
    if (sourceVpn === 'allowed') reasons.push('Same VPN access');
    else if (sourceVpn === 'blocked') reasons.push('Same geo restrictions');
  }

  const redeemShared = REDEEM_FEATURES.filter((f) => sharedFeatures.includes(f));
  if (redeemShared.length >= 2) reasons.push('Similar redeem options');

  const signupA = normalizeSignupTags(source.signupRequirements);
  const signupB = normalizeSignupTags(candidate.signupRequirements);
  if (signupA.length && signupA.join('|') === signupB.join('|')) reasons.push('Same signup style');

  if (textPct >= 35) reasons.push('Similar descriptions');
  if (Math.abs(source.rating - candidate.rating) <= 0.5) reasons.push('Similar rating');

  return [...new Set(reasons)].slice(0, 6);
}

export function computeSimilarity(source: Casino, candidate: Casino): SimilarCasinoMatch {
  const { ratio: featureRatio, shared } = weightedFeatureJaccard(source.features, candidate.features);
  const featurePercent = Math.round(featureRatio * 100);
  const textRatio = computeTextSimilarity(source, candidate);
  const textPercent = Math.round(textRatio * 100);

  let bonus = 0;
  const sourceVpn = vpnProfile(source.features);
  const candidateVpn = vpnProfile(candidate.features);
  if (sourceVpn !== 'unknown' && sourceVpn === candidateVpn) {
    bonus += 8;
  } else if (sourceVpn === 'allowed' && candidateVpn === 'blocked') {
    bonus -= 12;
  }

  const signupA = normalizeSignupTags(source.signupRequirements);
  const signupB = normalizeSignupTags(candidate.signupRequirements);
  if (signupA.length && signupA.join('|') === signupB.join('|')) bonus += 6;

  const ratingDiff = Math.abs(source.rating - candidate.rating);
  if (ratingDiff <= 0.3) bonus += 5;
  else if (ratingDiff <= 0.8) bonus += 2;

  if (source.verified && candidate.verified) bonus += 3;

  const redeemOverlap = REDEEM_FEATURES.filter((f) => shared.includes(f)).length;
  if (redeemOverlap >= 3) bonus += 6;
  else if (redeemOverlap >= 2) bonus += 3;

  const gameOverlap = GAME_FEATURES.filter((f) => shared.includes(f)).length;
  if (gameOverlap >= 3) bonus += 5;

  const blended = featureRatio * 0.62 + textRatio * 0.38;
  const matchPercent = Math.round(Math.min(100, Math.max(0, blended * 100 + bonus)));
  const score = Math.round(blended * 1000 + bonus * 10);

  const reasons = buildReasons(shared, source, candidate, sourceVpn, candidateVpn, textPercent);

  return {
    casino: candidate,
    score,
    matchPercent,
    sharedFeatures: shared,
    reasons,
    featurePercent,
    textPercent,
  };
}

/** Score a not-yet-catalog URL using inferred page features (web discovery ranking). */
export function scoreInferredSimilarity(
  source: Casino,
  inferred: Pick<Casino, 'name' | 'description' | 'features' | 'signupRequirements' | 'bonusInfo' | 'rating'>,
): number {
  const draft: Casino = {
    id: '__draft__',
    name: inferred.name,
    url: source.url,
    urlNormalized: source.urlNormalized,
    description: inferred.description,
    features: inferred.features,
    signupRequirements: inferred.signupRequirements,
    bonusInfo: inferred.bonusInfo,
    cashOutBeforeBlocked: null,
    trackables: [],
    rating: inferred.rating ?? source.rating,
    source: 'similar_web',
    verified: false,
    reviewStatus: 'pending',
    active: true,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    approvedAt: null,
    lastCheckedAt: null,
    healthStatus: 'ok',
    healthNote: '',
  };
  return computeSimilarity(source, draft).matchPercent;
}

export function rankSimilarCasinos(source: Casino, candidates: Casino[], limit = 8): SimilarCasinoMatch[] {
  return candidates
    .filter((c) => c.id !== source.id && c.active)
    .map((c) => computeSimilarity(source, c))
    .filter((m) => {
      if (m.matchPercent >= 18) return true;
      const sharedDistinct = m.sharedFeatures.filter((f) => !UNIVERSAL_FEATURES.has(f));
      return sharedDistinct.length >= 2 && m.matchPercent >= 12;
    })
    .sort((a, b) => {
      if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
      const distinctA = a.sharedFeatures.filter((f) => !UNIVERSAL_FEATURES.has(f)).length;
      const distinctB = b.sharedFeatures.filter((f) => !UNIVERSAL_FEATURES.has(f)).length;
      if (distinctB !== distinctA) return distinctB - distinctA;
      return b.score - a.score;
    })
    .slice(0, limit);
}

/** Top distinguishing features for building web search queries. */
export function getDistinguishingFeatures(casino: Casino, max = 6): CasinoFeature[] {
  return distinguishingFeatures(casino.features)
    .sort((a, b) => featureWeight(b) - featureWeight(a))
    .slice(0, max);
}
