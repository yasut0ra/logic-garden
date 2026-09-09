import { ALGORITHMS, type Algorithm } from '../algorithms/bandit';
import type { Observation } from '../circuit/evaluator';
import { Simulator, type SimulationConfig } from './simulator';
export interface ResearchRequest {
  config: SimulationConfig;
  observations: Observation[];
  trials: number;
  rounds: number;
}
export interface TrialResult {
  algorithm: Algorithm;
  seed: number;
  finalAccuracy: number;
  bestAccuracy: number;
  solvedAt: number | null;
  cumulativeReward: number;
  cumulativeRegret: number;
  size: number;
}
export interface ResearchSummary {
  algorithm: Algorithm;
  finalAccuracy: number;
  standardDeviation: number;
  solved: number;
  medianSolvedAt: number | null;
  cumulativeReward: number;
  cumulativeRegret: number;
  size: number;
  trials: number;
}
export function runTrial(
  request: ResearchRequest,
  algorithm: Algorithm,
  trial: number,
): TrialResult {
  const seed = (request.config.seed + trial) >>> 0;
  const simulator = new Simulator(
    { ...request.config, seed, algorithm },
    request.observations,
  );
  const state = simulator.advance(request.rounds);
  return {
    algorithm,
    seed,
    finalAccuracy: state.evaluation.accuracy,
    bestAccuracy: state.bestAccuracy,
    solvedAt: state.solvedAt,
    cumulativeReward: state.cumulativeReward,
    cumulativeRegret: state.cumulativeRegret,
    size: state.size,
  };
}
export function summarizeTrials(results: TrialResult[]): ResearchSummary[] {
  return ALGORITHMS.map((algorithm) => {
    const rows = results.filter((r) => r.algorithm === algorithm);
    const average = (
      key: 'finalAccuracy' | 'cumulativeReward' | 'cumulativeRegret' | 'size',
    ) =>
      rows.length ? rows.reduce((sum, r) => sum + r[key], 0) / rows.length : 0;
    const solved = rows
      .flatMap((r) => (r.solvedAt === null ? [] : [r.solvedAt]))
      .sort((a, b) => a - b);
    const finalAccuracy = average('finalAccuracy');
    return {
      algorithm,
      trials: rows.length,
      finalAccuracy,
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
      medianSolvedAt: solved.length
        ? (solved[Math.floor((solved.length - 1) / 2)]! +
            solved[Math.floor(solved.length / 2)]!) /
          2
        : null,
      cumulativeReward: average('cumulativeReward'),
      cumulativeRegret: average('cumulativeRegret'),
      size: average('size'),
    };
  });
}
