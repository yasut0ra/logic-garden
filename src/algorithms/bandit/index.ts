import type { Arm } from '../../circuit/mutations';
import { MAX_GATES } from '../../circuit/circuit';
import type { Random } from '../../random';
import { epsilonGreedy } from './epsilonGreedy';
import { ucb1 } from './ucb1';
import { thompsonSampling } from './thompsonSampling';
import type { Algorithm, BanditStats, Decision } from './types';
export * from './types';
export function selectArm(
  algorithm: Algorithm,
  stats: BanditStats,
  available: Arm[],
  rng: Random,
  epsilon: number,
): Decision {
  if (!available.length) throw new Error('No legal mutations available.');
  switch (algorithm) {
    case 'epsilon-greedy':
      return epsilonGreedy(stats, available, rng, epsilon);
    case 'ucb1':
      return ucb1(stats, available, rng);
    case 'thompson':
      return thompsonSampling(stats, available, rng);
    default:
      throw new Error('Use createPolicy for a contextual or random policy.');
  }
}
/** Fixed affine map shared by algorithms; never clip negative mutation outcomes. */
export function normalizeReward(reward: number, penalty: number): number {
  const bound = 1 + MAX_GATES * penalty;
  return Math.max(0, Math.min(1, (reward + bound) / (2 * bound)));
}
export function updateStats(
  stats: BanditStats,
  arm: Arm,
  reward: number,
  normalized: number,
  posteriorRng: Random,
): BanditStats {
  const previous = stats[arm];
  // Bernoulli resampling is unbiased for the normalized reward. Beta parameters
  // remain genuine success/failure counts (not fractional pseudo-observations).
  const success = posteriorRng.next() < normalized ? 1 : 0;
  return {
    ...stats,
    [arm]: {
      count: previous.count + 1,
      totalReward: previous.totalReward + reward,
      normalizedTotal: previous.normalizedTotal + normalized,
      alpha: previous.alpha + success,
      beta: previous.beta + 1 - success,
    },
  };
}
