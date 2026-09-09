import { ARMS, type Arm } from '../../circuit/mutations';
import type { Random } from '../../random';
export const ALGORITHMS = ['epsilon-greedy', 'ucb1', 'thompson'] as const;
export type Algorithm = (typeof ALGORITHMS)[number];
export const ALGORITHM_LABELS: Record<Algorithm, string> = {
  'epsilon-greedy': 'ε-Greedy',
  ucb1: 'UCB1',
  thompson: 'Thompson Sampling',
};
export interface ArmStats {
  count: number;
  totalReward: number;
  normalizedTotal: number;
  alpha: number;
  beta: number;
}
export type BanditStats = Record<Arm, ArmStats>;
export interface ArmScore {
  mean: number;
  bonus: number;
  score: number;
}
export interface Decision {
  arm: Arm;
  reason: string;
  exploratory: boolean;
  scores: Partial<Record<Arm, ArmScore>>;
}
export const freshStats = (): BanditStats =>
  Object.fromEntries(
    ARMS.map((arm) => [
      arm,
      { count: 0, totalReward: 0, normalizedTotal: 0, alpha: 1, beta: 1 },
    ]),
  ) as BanditStats;
export const mean = (stats: ArmStats) =>
  stats.count ? stats.normalizedTotal / stats.count : 0;
export function maximize(
  arms: Arm[],
  score: (arm: Arm) => number,
  rng: Random,
): Arm {
  const best = Math.max(...arms.map(score));
  return rng.pick(arms.filter((arm) => score(arm) === best));
}
export function coldStart(
  stats: BanditStats,
  available: Arm[],
  rng: Random,
): Decision | null {
  const untried = available.filter((arm) => stats[arm].count === 0);
  return untried.length
    ? {
        arm: rng.pick(untried),
        reason: 'Explore an untried mutation category.',
        exploratory: true,
        scores: {},
      }
    : null;
}
