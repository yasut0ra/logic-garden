import type { Arm } from '../../circuit/mutations';
import type { Random } from '../../random';
import {
  coldStart,
  maximize,
  mean,
  type BanditStats,
  type Decision,
  type ArmScore,
} from './types';
export function ucb1(
  stats: BanditStats,
  available: Arm[],
  rng: Random,
): Decision {
  const warmup = coldStart(stats, available, rng);
  if (warmup) return warmup;
  const total = Object.values(stats).reduce((sum, s) => sum + s.count, 0);
  const scores = Object.fromEntries(
    available.map((arm) => {
      const bonus = Math.sqrt(
        (2 * Math.log(Math.max(1, total))) / stats[arm].count,
      );
      return [
        arm,
        { mean: mean(stats[arm]), bonus, score: mean(stats[arm]) + bonus },
      ];
    }),
  ) as Record<Arm, ArmScore>;
  const arm = maximize(available, (a) => scores[a].score, rng);
  const exploratory =
    mean(stats[arm]) < Math.max(...available.map((a) => mean(stats[a])));
  return {
    arm,
    scores,
    exploratory,
    reason: exploratory
      ? 'Explore: uncertainty bonus outweighs a lower mean.'
      : 'Exploit: the highest UCB also has a best mean.',
  };
}
