import type { Arm } from '../../circuit/mutations';
import type { Random } from '../../random';
import { dot } from './linearAlgebra';
import type { LinearModels } from './linUCB';
import { maximize, type Decision, type ArmScore } from './types';
export function linearThompson(
  models: LinearModels,
  context: readonly number[],
  actions: Arm[],
  scale: number,
  rng: Random,
): Decision {
  const scores = Object.fromEntries(
    actions.map((arm) => {
      const prediction = models[arm].predict(context);
      const sampled = dot(context, models[arm].sampleWeights(rng, scale));
      return [
        arm,
        {
          ...prediction,
          bonus: sampled - prediction.mean,
          score: sampled,
          sampled,
        },
      ];
    }),
  ) as Record<Arm, ArmScore>;
  const arm = maximize(actions, (action) => scores[action].score, rng);
  return {
    arm,
    scores,
    exploratory:
      scores[arm].mean <
      Math.max(...actions.map((action) => scores[action].mean)) - 1e-12,
    reason:
      'Sample a coefficient vector for each action, then choose the highest sampled reward for this context.',
  };
}
