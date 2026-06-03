import type { CasinoFeature } from './types.js';

const VPN_BLOCKED_KEYWORDS = ['vpn not allowed', 'vpn blocked', 'no vpn', 'vpn prohibited', 'vpn detected', 'disable vpn'];
const VPN_ALLOWED_KEYWORDS = ['vpn allowed', 'vpn friendly', 'works with vpn', 'vpn ok', 'vpn supported'];
const GEO_RESTRICTED_KEYWORDS = ['geo restricted', 'not available in your region', 'not available in your state', 'region locked'];
const NO_PHONE_KEYWORDS = ['no phone', 'email only', 'email signup', 'no verification', 'no sms'];
const SLOT_KEYWORDS = ['slots', 'slot games', 'spin', 'jackpot'];
const LIVE_KEYWORDS = ['live dealer', 'live casino', 'live games'];

/** Infer catalog features from page text (homepage title, meta, body). */
export function inferFeaturesFromText(text: string): CasinoFeature[] {
  const lower = text.toLowerCase();
  const features: CasinoFeature[] = ['sweepstakes'];
  if (NO_PHONE_KEYWORDS.some((k) => lower.includes(k))) {
    features.push('no_phone');
    if (lower.includes('email only') || lower.includes('email signup') || lower.includes('no phone')) {
      features.push('email_only');
    }
  }
  if (SLOT_KEYWORDS.some((k) => lower.includes(k))) features.push('slots');
  if (LIVE_KEYWORDS.some((k) => lower.includes(k))) features.push('live_games');
  if (lower.includes('table') || lower.includes('poker') || lower.includes('blackjack')) features.push('table_games');
  if (lower.includes('sport')) features.push('sports');
  if (lower.includes('crypto') || lower.includes('bitcoin')) features.push('crypto');
  if (lower.includes('instant') || lower.includes('no download')) features.push('instant_play');
  if (VPN_BLOCKED_KEYWORDS.some((k) => lower.includes(k))) features.push('vpn_blocked');
  else if (VPN_ALLOWED_KEYWORDS.some((k) => lower.includes(k))) features.push('vpn_allowed');
  if (GEO_RESTRICTED_KEYWORDS.some((k) => lower.includes(k))) features.push('geo_restricted');
  if (lower.includes('no kyc')) features.push('no_kyc');
  if (lower.includes('daily bonus') || lower.includes('login bonus')) features.push('daily_bonus');
  if (lower.includes('welcome bonus') || lower.includes('welcome offer')) features.push('welcome_bonus');
  if (lower.includes('signup bonus') || lower.includes('sign-up bonus') || lower.includes('sign up bonus')) features.push('signup_bonus');
  if (lower.includes('no wagering') || lower.includes('zero wagering')) features.push('no_wagering');
  if (lower.includes('multiple states') || lower.includes('multi-state') || lower.includes('available in')) features.push('multi_state');
  if (lower.includes('pragmatic play') || lower.includes('pragmatic')) features.push('pragmatic_play');
  if (lower.includes('gift card')) features.push('gift_card_redeem');
  if (lower.includes('paypal')) features.push('paypal_redeem');
  if (lower.includes('mobile app')) features.push('mobile_app');
  if (lower.includes('bingo')) features.push('bingo');
  if (lower.includes('fish game') || lower.includes('fish shoot')) features.push('fish_games');
  if (lower.includes('poker')) features.push('poker');
  if (lower.includes('wheel') || lower.includes('spin wheel')) features.push('wheel_spin');
  if (lower.includes('no deposit') || lower.includes('free bonus')) features.push('no_deposit_bonus');
  if (lower.includes('venmo')) features.push('venmo_redeem');
  if (lower.includes('apple pay')) features.push('apple_pay');
  if (lower.includes('us only') || lower.includes('usa only')) features.push('us_only');
  if (lower.includes('progressive jackpot') || lower.includes('progressive')) features.push('progressive_jackpot');
  if (lower.includes('social') || lower.includes('friends')) features.push('social_features');
  if (lower.includes('web only') || lower.includes('browser only')) features.push('web_only');
  if (lower.includes('new casino') || lower.includes('just launched')) features.push('new_casino');
  if (lower.includes('cash app')) features.push('cash_app');
  if (lower.includes('zelle')) features.push('zelle_redeem');
  if (lower.includes('scratch')) features.push('scratch_cards');
  if (lower.includes('tournament')) features.push('tournaments');
  if (lower.includes('vip')) features.push('vip_program');
  if (lower.includes('android')) features.push('android_app');
  if (lower.includes('ios') || lower.includes('iphone')) features.push('ios_app');
  if (lower.includes('plinko')) features.push('plinko');
  if (lower.includes('keno')) features.push('keno');
  if (lower.includes('free spin')) features.push('free_spins');
  if (lower.includes('loyalty') || lower.includes('vip tier')) features.push('loyalty_program');
  if (lower.includes('blackjack')) features.push('blackjack');
  if (lower.includes('roulette')) features.push('roulette');
  if (lower.includes('crash game') || lower.includes('aviator')) features.push('crash_games');
  if (lower.includes('megaways')) features.push('megaways');
  if (lower.includes('hold and win') || lower.includes('hold & win')) features.push('hold_and_win');
  if (lower.includes('debit card')) features.push('debit_card_redeem');
  if (lower.includes('ach') || lower.includes('direct bank')) features.push('ach_redeem');
  if (lower.includes('live chat') || lower.includes('24/7 support')) features.push('live_chat');
  if (!features.includes('no_phone') && lower.includes('sign up')) features.push('email_only');
  return [...new Set(features)];
}
