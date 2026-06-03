import type { Casino, CasinoFeature } from './types.js';

export interface CasinoCompareResult {
  a: Casino;
  b: Casino;
  sharedFeatures: CasinoFeature[];
  onlyA: CasinoFeature[];
  onlyB: CasinoFeature[];
  ratingDiff: number;
}

export function compareCasinos(a: Casino, b: Casino): CasinoCompareResult {
  const sharedFeatures = a.features.filter((f) => b.features.includes(f));
  const onlyA = a.features.filter((f) => !b.features.includes(f));
  const onlyB = b.features.filter((f) => !a.features.includes(f));
  return {
    a,
    b,
    sharedFeatures,
    onlyA,
    onlyB,
    ratingDiff: Math.abs(a.rating - b.rating),
  };
}
