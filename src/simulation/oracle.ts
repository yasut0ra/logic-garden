import { Random } from '../random';
import {
  ARMS,
  type Arm,
  type Candidates,
  type Mutation,
} from '../circuit/mutations';
import { circuitDepth, gateCount } from '../circuit/circuit';
import {
  evaluateCircuit,
  type Evaluation,
  type Observation,
} from '../circuit/evaluator';
import { candidateReward, type Quality, type RewardSettings } from './reward';
export interface EvaluatedCandidate {
  mutation: Mutation;
  evaluation: Evaluation;
  quality: Quality;
  reward: number;
}
export interface OracleResult {
  bestArm: Arm;
  bestReward: number;
  selectedReward: number;
  instantRegret: number;
  rewards: Partial<Record<Arm, number>>;
  descriptions: Partial<Record<Arm, string>>;
}
/** Counter-based per-round/per-action samples keep oracle ON/OFF trajectories identical.
 * Candidate sampling never receives a context predictor or oracle reward.
 */
export function sampleMutation(
  candidates: Candidates,
  arm: Arm,
  seed: number,
  iteration: number,
): Mutation {
  const rng = new Random(
    seed ^
      Math.imul(iteration, 0x9e3779b1) ^
      Math.imul(ARMS.indexOf(arm) + 1, 0x85ebca6b),
  );
  return rng.pick(candidates[arm]);
}
export function evaluateCandidate(
  mutation: Mutation,
  observations: readonly Observation[],
  before: Quality,
  settings: RewardSettings,
): EvaluatedCandidate {
  const evaluation = evaluateCircuit(mutation.circuit, observations);
  const quality = {
    accuracy: evaluation.accuracy,
    gates: gateCount(mutation.circuit),
    depth: circuitDepth(mutation.circuit),
  };
  return {
    mutation,
    evaluation,
    quality,
    reward: candidateReward(before, quality, settings),
  };
}
/** One sampled candidate per AVAILABLE category, including the exact selected candidate.
 * Evaluation-only telemetry: unselected outcomes never update a model or best-known state.
 */
export function evaluateOracle(
  candidates: Candidates,
  selected: EvaluatedCandidate,
  seed: number,
  iteration: number,
  observations: readonly Observation[],
  before: Quality,
  settings: RewardSettings,
): OracleResult {
  const rewards: Partial<Record<Arm, number>> = {},
    descriptions: Partial<Record<Arm, string>> = {};
  let bestArm = selected.mutation.type,
    bestReward = selected.reward;
  for (const arm of ARMS) {
    if (!candidates[arm].length) continue;
    const candidate =
      arm === selected.mutation.type
        ? selected
        : evaluateCandidate(
            sampleMutation(candidates, arm, seed, iteration),
            observations,
            before,
            settings,
          );
    rewards[arm] = candidate.reward;
    descriptions[arm] = candidate.mutation.description;
    if (candidate.reward > bestReward) {
      bestReward = candidate.reward;
      bestArm = arm;
    }
  }
  return {
    bestArm,
    bestReward,
    selectedReward: selected.reward,
    instantRegret: Math.max(0, bestReward - selected.reward),
    rewards,
    descriptions,
  };
}
