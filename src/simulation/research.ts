import { ALGORITHM_LABELS, type Algorithm } from '../algorithms/bandit';
import { CONTEXT_LABELS, CONTEXT_MODES } from '../circuit/features';
import { ARMS, type Arm } from '../circuit/mutations';
import type { Observation } from '../circuit/evaluator';
import { REWARD_LABELS, REWARD_MODES } from './reward';
import { Simulator, type SimulationConfig } from './simulator';
export const COMPARISONS = ['algorithms', 'rewards', 'contexts'] as const;
export type Comparison = (typeof COMPARISONS)[number];
export const COMPARISON_LABELS = {
  algorithms: 'Four policies',
  rewards: 'Four reward designs · LinUCB',
  contexts: 'Three context profiles · LinUCB',
};
export interface ResearchRequest {
  config: SimulationConfig;
  observations: Observation[];
  trials: number;
  rounds: number;
  comparison: Comparison;
}
export interface Variant {
  id: string;
  label: string;
  config: SimulationConfig;
}
export function researchVariants(
  config: SimulationConfig,
  comparison: Comparison,
): Variant[] {
  if (comparison === 'algorithms')
    return (['random', 'ucb1', 'linucb', 'linear-thompson'] as Algorithm[]).map(
      (algorithm) => ({
        id: algorithm,
        label: ALGORITHM_LABELS[algorithm],
        config: { ...config, algorithm },
      }),
    );
  if (comparison === 'rewards')
    return REWARD_MODES.map((rewardMode) => ({
      id: rewardMode,
      label: REWARD_LABELS[rewardMode],
      config: { ...config, algorithm: 'linucb', rewardMode },
    }));
  if (comparison === 'contexts')
    return CONTEXT_MODES.map((contextMode) => ({
      id: contextMode,
      label: CONTEXT_LABELS[contextMode],
      config: { ...config, algorithm: 'linucb', contextMode },
    }));
  throw new Error('Unknown comparison.');
}
export interface TrialResult {
  variant: string;
  label: string;
  algorithm: Algorithm;
  seed: number;
  finalAccuracy: number;
  bestAccuracy: number;
  solvedAt: number | null;
  cumulativeReward: number;
  cumulativeRegret: number;
  size: number;
  depth: number;
  accepted: number;
  actions: Record<Arm, number>;
}
export interface ResearchSummary {
  variant: string;
  label: string;
  finalAccuracy: number;
  bestAccuracy: number;
  standardDeviation: number;
  solved: number;
  censored: number;
  medianSolvedAt: number | null;
  cumulativeReward: number;
  cumulativeRegret: number;
  size: number;
  depth: number;
  accepted: number;
  actions: Record<Arm, number>;
  trials: number;
}
export function runTrial(
  request: ResearchRequest,
  variant: Variant,
  trial: number,
): TrialResult {
  const seed = (request.config.seed + trial) >>> 0;
  const simulator = new Simulator(
    { ...variant.config, seed, maxIterations: request.rounds, oracle: true },
    request.observations,
  );
  const s = simulator.advance(request.rounds);
  return {
    variant: variant.id,
    label: variant.label,
    algorithm: variant.config.algorithm,
    seed,
    finalAccuracy: s.evaluation.accuracy,
    bestAccuracy: s.bestAccuracy,
    solvedAt: s.solvedAt,
    cumulativeReward: s.cumulativeReward,
    cumulativeRegret: s.cumulativeRegret!,
    size: s.size,
    depth: s.depth,
    accepted: s.acceptedCount,
    actions: Object.fromEntries(
      ARMS.map((a) => [a, s.stats[a].count]),
    ) as Record<Arm, number>,
  };
}
export function summarizeTrials(results: TrialResult[]): ResearchSummary[] {
  return [...new Set(results.map((r) => r.variant))].map((variant) => {
    const rows = results.filter((r) => r.variant === variant);
    const average = (
      key:
        | 'finalAccuracy'
        | 'bestAccuracy'
        | 'cumulativeReward'
        | 'cumulativeRegret'
        | 'size'
        | 'depth'
        | 'accepted',
    ) => rows.reduce((sum, r) => sum + r[key], 0) / rows.length;
    const solved = rows
      .flatMap((r) => (r.solvedAt === null ? [] : [r.solvedAt]))
      .sort((a, b) => a - b);
    const finalAccuracy = average('finalAccuracy');
    return {
      variant,
      label: rows[0]!.label,
      trials: rows.length,
      finalAccuracy,
      bestAccuracy: average('bestAccuracy'),
      standardDeviation:
        rows.length < 2
          ? 0
          : Math.sqrt(
              rows.reduce(
                (sum, r) => sum + (r.finalAccuracy - finalAccuracy) ** 2,
                0,
              ) /
                (rows.length - 1),
            ),
      solved: solved.length,
      censored: rows.length - solved.length,
      medianSolvedAt: solved.length
        ? (solved[Math.floor((solved.length - 1) / 2)]! +
            solved[Math.floor(solved.length / 2)]!) /
          2
        : null,
      cumulativeReward: average('cumulativeReward'),
      cumulativeRegret: average('cumulativeRegret'),
      size: average('size'),
      depth: average('depth'),
      accepted: average('accepted'),
      actions: Object.fromEntries(
        ARMS.map((a) => [a, rows.reduce((sum, r) => sum + r.actions[a], 0)]),
      ) as Record<Arm, number>,
    };
  });
}

/** One export schema for the UI and headless benchmark. Record effective settings,
 * including the research budget and mandatory oracle, rather than live defaults.
 */
export function researchExport(
  request: ResearchRequest,
  target: string,
  results: TrialResult[],
) {
  const config = {
    ...request.config,
    oracle: true,
    maxIterations: request.rounds,
  };
  return {
    format: 'logic-garden-research-v2',
    target,
    config,
    observations: request.observations,
    trials: request.trials,
    rounds: request.rounds,
    comparison: request.comparison,
    variants: researchVariants(config, request.comparison),
    results,
    summaries: summarizeTrials(results),
  };
}
