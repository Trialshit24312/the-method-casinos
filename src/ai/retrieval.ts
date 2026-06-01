import { searchCasinos } from '../database/index.js';
import type { Casino, CasinoFeature } from '../shared/types.js';
import { FEATURE_LABELS } from '../shared/types.js';

const FEATURE_ALIASES: Record<string, CasinoFeature[]> = {
  phone: ['no_phone'],
  nophone: ['no_phone'],
  email: ['email_only'],
  vpn: ['vpn_allowed', 'vpn_blocked'],
  slots: ['slots'],
  slot: ['slots'],
  live: ['live_games'],
  fish: ['fish_games'],
  bingo: ['bingo'],
  poker: ['poker'],
  redeem: ['low_min_redeem', 'fast_payout', 'paypal_redeem', 'gift_card_redeem'],
  payout: ['fast_payout'],
  paypal: ['paypal_redeem'],
  venmo: ['venmo_redeem'],
  crypto: ['crypto'],
  new: ['new_casino'],
  jackpot: ['progressive_jackpot'],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function scoreCasino(casino: Casino, tokens: string[]): number {
  if (!tokens.length) return casino.rating;

  const nameLower = casino.name.toLowerCase();
  const descLower = casino.description.toLowerCase();
  const featureText = casino.features.map((f) => FEATURE_LABELS[f] ?? f).join(' ').toLowerCase();
  const signupText = casino.signupRequirements.join(' ').toLowerCase();
  let score = casino.rating * 0.1;

  for (const token of tokens) {
    if (nameLower.includes(token)) score += 12;
    if (descLower.includes(token)) score += 3;
    if (featureText.includes(token)) score += 5;
    if (signupText.includes(token)) score += 4;
    for (const feat of FEATURE_ALIASES[token] ?? []) {
      if (casino.features.includes(feat)) score += 8;
    }
  }

  if (tokens.some((t) => t.includes('no') && t.includes('phone')) && casino.features.includes('no_phone')) {
    score += 15;
  }
  if (tokens.some((t) => t.includes('email')) && casino.features.includes('email_only')) {
    score += 12;
  }

  return score;
}

/** Rank verified catalog casinos by relevance to a user question. */
export function retrieveCatalogForQuery(query: string, limit = 15): Casino[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return searchCasinos({ catalogOnly: true, limit });
  }

  const tokens = tokenize(trimmed);
  const direct = searchCasinos({ query: trimmed, catalogOnly: true, limit: 40 });
  const pool = direct.length >= limit
    ? direct
    : [...direct, ...searchCasinos({ catalogOnly: true, limit: 80 }).filter(
        (c) => !direct.some((d) => d.id === c.id),
      )];

  return pool
    .map((casino) => ({ casino, score: scoreCasino(casino, tokens) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.casino);
}
