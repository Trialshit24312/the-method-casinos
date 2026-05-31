import type { CasinoFeature } from './types.js';

const FEATURE_SCORES: Partial<Record<CasinoFeature, number>> = {
  no_phone: 0.4,
  email_only: 0.3,
  slots: 0.25,
  live_games: 0.5,
  table_games: 0.2,
  instant_play: 0.15,
  sports: 0.2,
  crypto: 0.15,
  sweepstakes: 0.1,
  vpn_allowed: 0.15,
  geo_restricted: -0.1,
  daily_bonus: 0.15,
  referral_bonus: 0.1,
  low_min_redeem: 0.2,
  fish_games: 0.15,
  poker: 0.2,
  bingo: 0.1,
  progressive_jackpot: 0.25,
  no_deposit_bonus: 0.2,
  new_casino: -0.05,
  venmo_redeem: 0.15,
  apple_pay: 0.1,
  free_spins: 0.15,
  loyalty_program: 0.1,
  megaways: 0.15,
  live_chat: 0.05,
  welcome_bonus: 0.15,
  signup_bonus: 0.15,
  no_wagering: 0.25,
  multi_state: 0.1,
  pragmatic_play: 0.1,
};

export function inferRating(
  features: CasinoFeature[] = [],
  options: { verified?: boolean; source?: string } = {},
): number {
  let score = options.source === 'seed' ? 4.0 : 3.0;

  for (const feature of features) {
    score += FEATURE_SCORES[feature] ?? 0;
  }

  if (options.verified) score += 0.4;
  if (features.includes('no_phone') && features.includes('email_only')) score += 0.2;

  return Math.min(5, Math.max(2.5, Math.round(score * 10) / 10));
}

export function resolveRating(
  rating: number | undefined,
  features: CasinoFeature[] = [],
  options: { verified?: boolean; source?: string } = {},
): number {
  if (rating !== undefined && rating > 0) return rating;
  return inferRating(features, options);
}
