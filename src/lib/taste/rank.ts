/**
 * Transparent, reproducible duo ranking.
 *
 * Qloo affinities for one person are dominated by how popular a place is, and two people's
 * raw affinities sit on different scales. So for each person we:
 *   1. z-score their affinities within the shared candidate pool (removes scale differences),
 *   2. regress out place popularity to isolate the taste-specific part (the "lift"),
 *   3. blend overall fit and taste lift into a 0-1 percentile fit.
 * The duo score then favours the place where the *less happy* person is still happy (min),
 * with a smaller weight on the average and on occasion/vibe matches.
 */

export interface PoolItem {
  id: string;
  popularity: number;
  affinityA: number;
  affinityB: number;
  /** 0-1 bonus from occasion and vibe tag matches. */
  contextBonus: number;
  /** 0-1 soft penalty (e.g. closed today). */
  penalty?: number;
  /** Business rating 0-5 when known. */
  rating?: number | null;
}

export interface RankedItem {
  id: string;
  fitA: number;
  fitB: number;
  rankA: number;
  rankB: number;
  fair: number;
}

function mean(xs: number[]) {
  return xs.reduce((s, x) => s + x, 0) / Math.max(xs.length, 1);
}

export function zScores(xs: number[]): number[] {
  const m = mean(xs);
  const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  if (!sd) return xs.map(() => 0);
  return xs.map((x) => (x - m) / sd);
}

/** Residual of y after removing its linear dependence on x (both already z-scored). */
export function residuals(y: number[], x: number[]): number[] {
  const varX = mean(x.map((v) => v * v));
  const slope = varX ? mean(y.map((v, i) => v * (x[i] ?? 0))) / varX : 0;
  return y.map((v, i) => v - slope * (x[i] ?? 0));
}

/** Percentile rank in [0, 1]; the highest value gets 1. Ties share the average rank. */
export function percentiles(xs: number[]): number[] {
  if (xs.length === 1) return [1];
  const order = xs.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v);
  const out = new Array<number>(xs.length).fill(0);
  let k = 0;
  while (k < order.length) {
    let j = k;
    while (j + 1 < order.length && order[j + 1]!.v === order[k]!.v) j += 1;
    const avg = (k + j) / 2 / (xs.length - 1);
    for (let t = k; t <= j; t += 1) out[order[t]!.i] = avg;
    k = j + 1;
  }
  return out;
}

function personFits(aff: number[], popZ: number[]): number[] {
  const z = zScores(aff);
  const overall = percentiles(z);
  const lift = percentiles(residuals(z, popZ));
  return overall.map((o, i) => 0.45 * o + 0.55 * (lift[i] ?? 0));
}

function ranksOf(scores: number[]): number[] {
  const order = scores.map((s, i) => ({ s, i })).sort((p, q) => q.s - p.s);
  const ranks = new Array<number>(scores.length).fill(0);
  order.forEach((o, r) => {
    ranks[o.i] = r + 1;
  });
  return ranks;
}

export function rankDuo(pool: PoolItem[]): RankedItem[] {
  if (pool.length === 0) return [];
  const popZ = zScores(pool.map((p) => p.popularity));
  const fitA = personFits(
    pool.map((p) => p.affinityA),
    popZ,
  );
  const fitB = personFits(
    pool.map((p) => p.affinityB),
    popZ,
  );
  const rankA = ranksOf(fitA);
  const rankB = ranksOf(fitB);

  return pool
    .map((p, i) => {
      const fa = fitA[i] ?? 0;
      const fb = fitB[i] ?? 0;
      const quality = p.rating ? Math.max(0, Math.min(1, (p.rating - 3.5) / 1.5)) : 0.3;
      const fair =
        0.6 * Math.min(fa, fb) +
        0.2 * ((fa + fb) / 2) +
        0.14 * p.contextBonus +
        0.06 * quality -
        0.15 * (p.penalty ?? 0);
      return { id: p.id, fitA: fa, fitB: fb, rankA: rankA[i] ?? pool.length, rankB: rankB[i] ?? pool.length, fair };
    })
    .sort((x, y) => y.fair - x.fair);
}
