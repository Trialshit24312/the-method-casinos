import type { Casino, CasinoFeature } from './types.js';

export interface SimilarCasinoMatch {
  casino: Casino;
  score: number;
  matchPercent: number;
  sharedFeatures: CasinoFeature[];
  reasons: string[];
}

const FEATURE_WEIGHTS: Partial<Record<CasinoFeature, number>> = {
  no_phone: 4,
  email_only: 3.5,
  slots: 3,
  live_games: 3,
  sweepstakes: 2,
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
  daily_bonus: 1.5,
  instant_play: 2,
  gift_card_redeem: 2,
  paypal_redeem: 2,
  venmo_redeem: 2,
  cash_app: 2,
  zelle_redeem: 2,
  apple_pay: 1.5,
  mobile_app: 1.5,
  android_app: 1.5,
  ios_app: 1.5,
  new_casino: 1,
  progressive_jackpot: 2,
  megaways: 2,
  plinko: 2,
  crash_games: 2,
  free_spins: 1.5,
};

const VPN_FEATURES: CasinoFeature[] = ['vpn_allowed', 'vpn_blocked', 'geo_restricted'];

function vpnProfile(features: CasinoFeature[]): string {
  if (features.includes('vpn_blocked')) return 'blocked';
  if (features.includes('vpn_allowed')) return 'allowed';
  if (features.includes('geo_restricted')) return 'geo';
  return 'unknown';
}

function signupProfile(reqs: string[]): string {
  return reqs.map((r) => r.toLowerCase()).sort().join('|');
}

export function computeSimilarity(source: Casino, candidate: Casino): SimilarCasinoMatch {
  const sharedFeatures = source.features.filter((f) => candidate.features.includes(f));
  const reasons: string[] = [];

  let score = 0;
  let maxPossible = 0;

  const sourceFeatureSet = new Set(source.features);
  const unionFeatures = new Set([...source.features, ...candidate.features]);

  for (const feature of unionFeatures) {
    const weight = FEATURE_WEIGHTS[feature] ?? 1;
    maxPossible += weight;
    if (sourceFeatureSet.has(feature) && candidate.features.includes(feature)) {
      score += weight;
    }
  }

  if (sharedFeatures.includes('no_phone')) reasons.push('No phone required');
  if (sharedFeatures.includes('email_only')) reasons.push('Email-only signup');
  if (sharedFeatures.includes('slots')) reasons.push('Slots');
  if (sharedFeatures.includes('live_games')) reasons.push('Live games');
  if (sharedFeatures.includes('fish_games')) reasons.push('Fish games');
  if (sharedFeatures.includes('vpn_allowed')) reasons.push('VPN friendly');

  const sourceVpn = vpnProfile(source.features);
  const candidateVpn = vpnProfile(candidate.features);
  if (sourceVpn !== 'unknown' && sourceVpn === candidateVpn) {
    score += 4;
    maxPossible += 4;
    if (sourceVpn === 'allowed') reasons.push('Same VPN access');
  } else if (sourceVpn === 'allowed' && candidateVpn === 'blocked') {
    score -= 3;
  }

  if (signupProfile(source.signupRequirements) === signupProfile(candidate.signupRequirements) && source.signupRequirements.length) {
    score += 3;
    maxPossible += 3;
    reasons.push('Same signup style');
  }

  const ratingDiff = Math.abs(source.rating - candidate.rating);
  if (ratingDiff <= 0.3) {
    score += 4;
    maxPossible += 4;
    reasons.push('Similar rating');
  } else if (ratingDiff <= 0.8) {
    score += 2;
    maxPossible += 4;
  }

  if (source.verified && candidate.verified) {
    score += 2;
    maxPossible += 2;
    reasons.push('Both verified');
  }

  const redeemOverlap = sharedFeatures.filter((f) =>
    f.includes('redeem') || f === 'fast_payout' || f === 'low_min_redeem' || f === 'cash_app' || f === 'bank_transfer',
  );
  if (redeemOverlap.length >= 2) {
    score += 2;
    reasons.push('Similar redeem options');
  }

  const normalized = maxPossible > 0 ? (score / maxPossible) * 100 : 0;
  const matchPercent = Math.round(Math.min(100, Math.max(0, normalized)));

  return {
    casino: candidate,
    score,
    matchPercent,
    sharedFeatures,
    reasons: [...new Set(reasons)].slice(0, 5),
  };
}

export function rankSimilarCasinos(source: Casino, candidates: Casino[], limit = 8): SimilarCasinoMatch[] {
  return candidates
    .filter((c) => c.id !== source.id && c.active)
    .map((c) => computeSimilarity(source, c))
    .filter((m) => m.matchPercent >= 20 && m.sharedFeatures.length >= 1)
    .sort((a, b) => b.matchPercent - a.matchPercent || b.score - a.score)
    .slice(0, limit);
}
