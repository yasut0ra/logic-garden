import { ARMS, type Arm } from '../../circuit/mutations';
import { Random } from '../../random';
import { normalizedReward } from '../../simulation/reward';
import { selectArm, updateStats } from './index';
import { LinearModel } from './linearAlgebra';
import { linUCB, type LinearModels } from './linUCB';
import { linearThompson } from './linearThompson';
import {
  freshStats,
  maximize,
  type Algorithm,
  type BanditStats,
  type Decision,
  type ArmScore,
} from './types';
export interface BanditPolicy {
  selectAction(context: readonly number[], actions: Arm[]): Decision;
  update(context: readonly number[], action: Arm, reward: number): void;
  getActionStats(): BanditStats;
}
export interface PolicySettings {
  algorithm: Algorithm;
  seed: number;
  epsilon: number;
  alpha: number;
  ridge: number;
  rewardMin: number;
  rewardMax: number;
}
export const isContextual = (algorithm: Algorithm) =>
  ['linucb', 'linear-thompson', 'contextual-epsilon'].includes(algorithm);
/** Common adapter: all policies learn only the selected (pre-action x, a, raw r).
 * Legacy empirical policies normalize internally; the inspector always uses raw reward units.
 */
class Policy implements BanditPolicy {
  private stats = freshStats();
  private readonly selectionRng: Random;
  private readonly posteriorRng: Random;
  private readonly models: LinearModels | null;
  constructor(
    private settings: PolicySettings,
    private dimension: number,
  ) {
    if (
      !Number.isFinite(settings.alpha) ||
      settings.alpha < 0 ||
      !Number.isFinite(settings.epsilon) ||
      settings.epsilon < 0 ||
      settings.epsilon > 1 ||
      !Number.isFinite(settings.ridge) ||
      settings.ridge <= 0 ||
      settings.rewardMax <= settings.rewardMin
    )
      throw new Error('Invalid policy settings.');
    this.selectionRng = new Random(settings.seed ^ 0xa341316c);
    this.posteriorRng = new Random(settings.seed ^ 0xad90777d);
    this.models = isContextual(settings.algorithm)
      ? (Object.fromEntries(
          ARMS.map((arm) => [arm, new LinearModel(dimension, settings.ridge)]),
        ) as LinearModels)
      : null;
    if (this.models)
      for (const arm of ARMS)
        this.stats[arm].coefficients = this.models[arm].coefficients();
  }
  private validate(context: readonly number[]) {
    if (
      context.length !== this.dimension ||
      context.some((value) => !Number.isFinite(value))
    )
      throw new Error('Invalid policy context.');
  }
  selectAction(context: readonly number[], actions: Arm[]): Decision {
    this.validate(context);
    if (!actions.length || actions.some((arm) => !ARMS.includes(arm)))
      throw new Error('No valid actions available.');
    const { algorithm, alpha, epsilon } = this.settings;
    if (algorithm === 'random')
      return {
        arm: this.selectionRng.pick(actions),
        scores: {},
        exploratory: true,
        reason:
          'Uniform random choice among available actions. Context is not used.',
      };
    if (algorithm === 'linucb')
      return linUCB(this.models!, context, actions, alpha, this.selectionRng);
    if (algorithm === 'linear-thompson')
      return linearThompson(
        this.models!,
        context,
        actions,
        alpha,
        this.selectionRng,
      );
    if (algorithm === 'contextual-epsilon') {
      const scores = Object.fromEntries(
        actions.map((arm) => {
          const prediction = this.models![arm].predict(context);
          return [arm, { ...prediction, bonus: 0, score: prediction.mean }];
        }),
      ) as Record<Arm, ArmScore>;
      const exploratory = this.selectionRng.next() < epsilon;
      const arm = exploratory
        ? this.selectionRng.pick(actions)
        : maximize(
            actions,
            (action) => scores[action].score,
            this.selectionRng,
          );
      return {
        arm,
        scores,
        exploratory,
        reason: exploratory
          ? `Explore with ε=${epsilon.toFixed(2)}: sample an available action.`
          : 'Exploit the highest linear prediction for the observed context.',
      };
    }
    const decision = selectArm(
      algorithm,
      this.stats,
      actions,
      this.selectionRng,
      epsilon,
    );
    const range = this.settings.rewardMax - this.settings.rewardMin;
    const toRaw = (value: number) => this.settings.rewardMin + value * range;
    const scores = Object.fromEntries(
      Object.entries(decision.scores).map(([arm, score]) => [
        arm,
        {
          mean: toRaw(score.mean),
          bonus:
            algorithm === 'thompson'
              ? toRaw(score.score) - toRaw(score.mean)
              : score.bonus * range,
          score: toRaw(score.score),
          ...(algorithm === 'thompson' ? { sampled: toRaw(score.score) } : {}),
        },
      ]),
    );
    return { ...decision, scores };
  }
  update(context: readonly number[], action: Arm, reward: number): void {
    this.validate(context);
    if (!ARMS.includes(action) || !Number.isFinite(reward))
      throw new Error('Invalid selected action or reward.');
    const tolerance = 1e-10;
    if (
      reward < this.settings.rewardMin - tolerance ||
      reward > this.settings.rewardMax + tolerance
    )
      throw new Error('Reward is outside the configured bounds.');
    if (this.models) this.models[action].update(context, reward);
    this.stats = updateStats(
      this.stats,
      action,
      reward,
      normalizedReward(reward, {
        min: this.settings.rewardMin,
        max: this.settings.rewardMax,
      }),
      this.posteriorRng,
    );
    if (this.models)
      this.stats = {
        ...this.stats,
        [action]: {
          ...this.stats[action],
          coefficients: this.models[action].coefficients(),
        },
      };
  }
  getActionStats(): BanditStats {
    return this.stats;
  }
}
export const createPolicy = (
  settings: PolicySettings,
  dimension: number,
): BanditPolicy => new Policy(settings, dimension);
