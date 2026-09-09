import type { Arm } from '../../circuit/mutations';
import type { Random } from '../../random';
import {
  coldStart,
  maximize,
  mean,
  type BanditStats,
  type Decision,
} from './types';
export function epsilonGreedy(
  stats: BanditStats,
  available: Arm[],
  rng: Random,
  epsilon: number,
): Decision {
  const warmup = coldStart(stats, available, rng);
  if (warmup) return warmup;
  const exploratory = rng.next() < epsilon;
  return {
    arm: exploratory
      ? rng.pick(available)
      : maximize(available, (arm) => mean(stats[arm]), rng),
    reason: exploratory
      ? `Explore: ε=${epsilon.toFixed(2)}, sample an available category.`
      : 'Exploit: choose the highest estimated mean reward.',
    exploratory,
    scores: Object.fromEntries(
      available.map((arm) => [
        arm,
        { mean: mean(stats[arm]), bonus: 0, score: mean(stats[arm]) },
      ]),
    ),
  };
}
