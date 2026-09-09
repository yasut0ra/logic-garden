import type { Arm } from '../../circuit/mutations';
import type { Random } from '../../random';
import { maximize, type Decision, type ArmScore } from './types';
import type { LinearModel } from './linearAlgebra';
export type LinearModels = Record<Arm, LinearModel>;
export function linUCB(
  models: LinearModels,
  context: readonly number[],
  actions: Arm[],
  alpha: number,
  rng: Random,
): Decision {
  const scores = Object.fromEntries(
    actions.map((arm) => {
      const prediction = models[arm].predict(context),
        bonus = alpha * prediction.uncertainty;
      return [arm, { ...prediction, bonus, score: prediction.mean + bonus }];
    }),
  ) as Record<Arm, ArmScore>;
  const arm = maximize(actions, (action) => scores[action].score, rng);
  const exploratory =
    scores[arm].mean <
    Math.max(...actions.map((action) => scores[action].mean)) - 1e-12;
  return {
    arm,
    scores,
    exploratory,
    reason: exploratory
      ? 'Uncertainty bonus wins over a lower predicted reward in this context.'
      : 'The largest predicted reward also wins after adding the uncertainty bonus.',
  };
}
