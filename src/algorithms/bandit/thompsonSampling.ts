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
export function thompsonSampling(
  stats: BanditStats,
  available: Arm[],
  rng: Random,
): Decision {
  const warmup = coldStart(stats, available, rng);
  if (warmup) return warmup;
  const scores = Object.fromEntries(
    available.map((arm) => [
      arm,
      {
        mean: mean(stats[arm]),
        bonus: 0,
        score: rng.beta(stats[arm].alpha, stats[arm].beta),
      },
    ]),
  ) as Record<Arm, ArmScore>;
  const arm = maximize(available, (a) => scores[a].score, rng);
  return {
    arm,
    scores,
    exploratory:
      mean(stats[arm]) < Math.max(...available.map((a) => mean(stats[a]))),
    reason:
      'Draw θ ~ Beta(α, β) for each available arm; choose the largest draw.',
  };
}
