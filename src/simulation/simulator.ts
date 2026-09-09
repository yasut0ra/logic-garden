import {
  circuitDepth,
  gateCount,
  initialCircuit,
  type Circuit,
} from '../circuit/circuit';
import {
  evaluateCircuit,
  type Evaluation,
  type Observation,
} from '../circuit/evaluator';
import {
  ARMS,
  generateMutations,
  type Arm,
  type Candidates,
  type Mutation,
} from '../circuit/mutations';
import {
  ALGORITHMS,
  type Algorithm,
  type BanditStats,
  type Decision,
} from '../algorithms/bandit';
import {
  createPolicy,
  type BanditPolicy,
} from '../algorithms/bandit/BanditPolicy';
import {
  CONTEXT_MODES,
  extractContext,
  type Context,
  type ContextMode,
} from '../circuit/features';
import {
  REWARD_MODES,
  rewardBounds,
  complexity,
  type RewardMode,
} from './reward';
import { acceptCandidate } from './acceptance';
import {
  evaluateCandidate,
  evaluateOracle,
  sampleMutation,
  type OracleResult,
} from './oracle';
export interface SimulationConfig {
  seed: number;
  algorithm: Algorithm;
  epsilon: number;
  penalty: number;
  depthWeight: number;
  alpha: number;
  ridge: number;
  contextMode: ContextMode;
  rewardMode: RewardMode;
  maxIterations: number;
  oracle: boolean;
}
export const DEFAULT_CONFIG: SimulationConfig = {
  seed: 42,
  algorithm: 'linucb',
  epsilon: 0.15,
  penalty: 0.01,
  depthWeight: 0.5,
  alpha: 0.5,
  ridge: 1,
  contextMode: 'full',
  rewardMode: 'accuracy-delta',
  maxIterations: 1000,
  oracle: true,
};
export interface HistoryPoint {
  iteration: number;
  accuracy: number;
  reward: number;
  regret: number | null;
  size: number;
}
export interface RoundLog {
  iteration: number;
  mutation: Omit<Mutation, 'circuit'>;
  before: number;
  after: number;
  reward: number;
  accepted: boolean;
  reason: string;
  context: number[];
  predicted: number | null;
  instantRegret: number | null;
}
export interface Snapshot {
  iteration: number;
  circuit: Circuit;
  evaluation: Evaluation;
  bestAccuracy: number;
  bestCircuit: Circuit;
  reward: number;
  cumulativeReward: number;
  cumulativeRegret: number | null;
  size: number;
  depth: number;
  stats: BanditStats;
  decision: Decision | null;
  last: RoundLog | null;
  logs: RoundLog[];
  history: HistoryPoint[];
  available: Arm[];
  candidateCounts: Record<Arm, number>;
  exploratoryCount: number;
  acceptedCount: number;
  solvedAt: number | null;
  nodeActivity: Record<string, number>;
  lastImprovementIteration: number;
  context: Context;
  decisionContext: Context | null;
  oracle: OracleResult | null;
  candidate: Circuit | null;
  beforeCircuit: Circuit | null;
  budget: number;
  complete: boolean;
}
export function validateConfig(config: SimulationConfig): void {
  if (
    !Number.isInteger(config.seed) ||
    config.seed < 0 ||
    config.seed > 0xffffffff
  )
    throw new Error('Seed must be a uint32 integer.');
  if (
    !ALGORITHMS.includes(config.algorithm) ||
    !CONTEXT_MODES.includes(config.contextMode) ||
    !REWARD_MODES.includes(config.rewardMode)
  )
    throw new Error('Unknown experiment mode.');
  if (
    !Number.isInteger(config.maxIterations) ||
    config.maxIterations < 1 ||
    config.maxIterations > 10000
  )
    throw new Error('Iteration budget must be 1–10000.');
  for (const [key, min, max] of [
    ['epsilon', 0, 1],
    ['penalty', 0, 0.2],
    ['depthWeight', 0, 2],
    ['alpha', 0, 5],
    ['ridge', 0.01, 100],
  ] as const) {
    if (!Number.isFinite(config[key]) || config[key] < min || config[key] > max)
      throw new Error(`Invalid ${key}: expected ${min}–${max}.`);
  }
  if (typeof config.oracle !== 'boolean')
    throw new Error('Oracle mode must be boolean.');
}
/** One-round coordinator, with no UI, clocks, or target expression access.
 * x_t is extracted BEFORE selection and the exact same vector updates only a_t.
 */
export class Simulator {
  readonly config: SimulationConfig;
  readonly observations: readonly Observation[];
  private readonly policy: BanditPolicy;
  private readonly scale: number;
  private candidates: Candidates;
  private state: Snapshot;
  constructor(config: SimulationConfig, observations: readonly Observation[]) {
    validateConfig(config);
    if (
      observations.length !== 8 ||
      observations.some(
        (row, index) =>
          (row.expected !== 0 && row.expected !== 1) ||
          row.input.length !== 3 ||
          row.input.some((bit, i) => bit !== ((index >> (2 - i)) & 1)),
      )
    )
      throw new Error('Expected eight ordered Boolean observations (000–111).');
    this.config = { ...config };
    this.observations = observations.map((row) => ({
      ...row,
      input: [...row.input] as typeof row.input,
    }));
    const circuit = initialCircuit(),
      evaluation = evaluateCircuit(circuit, this.observations);
    const bounds = rewardBounds(config);
    this.scale = Math.max(Math.abs(bounds.min), Math.abs(bounds.max));
    const context = extractContext(
      {
        circuit,
        evaluation,
        bestAccuracy: evaluation.accuracy,
        iteration: 0,
        maxIterations: config.maxIterations,
        acceptedCount: 0,
        lastImprovementIteration: 0,
        recent: [],
        observations: this.observations,
        rewardScale: this.scale,
      },
      config.contextMode,
    );
    this.policy = createPolicy(
      { ...config, rewardMin: bounds.min, rewardMax: bounds.max },
      context.vector.length,
    );
    this.candidates = generateMutations(circuit);
    this.state = {
      iteration: 0,
      circuit,
      evaluation,
      bestAccuracy: evaluation.accuracy,
      bestCircuit: circuit,
      reward: 0,
      cumulativeReward: 0,
      cumulativeRegret: config.oracle ? 0 : null,
      size: gateCount(circuit),
      depth: circuitDepth(circuit),
      stats: this.policy.getActionStats(),
      decision: null,
      last: null,
      logs: [],
      history: [
        {
          iteration: 0,
          accuracy: evaluation.accuracy,
          reward: 0,
          regret: config.oracle ? 0 : null,
          size: gateCount(circuit),
        },
      ],
      available: [],
      candidateCounts: {} as Record<Arm, number>,
      exploratoryCount: 0,
      acceptedCount: 0,
      solvedAt: evaluation.accuracy === 1 ? 0 : null,
      nodeActivity: {},
      lastImprovementIteration: 0,
      context,
      decisionContext: null,
      oracle: null,
      candidate: null,
      beforeCircuit: null,
      budget: config.maxIterations,
      complete: false,
    };
    this.refreshAvailability();
  }
  private refreshAvailability() {
    this.state = {
      ...this.state,
      available: ARMS.filter((arm) => this.candidates[arm].length > 0),
      candidateCounts: Object.fromEntries(
        ARMS.map((arm) => [arm, this.candidates[arm].length]),
      ) as Record<Arm, number>,
    };
  }
  snapshot(): Snapshot {
    return this.state;
  }
  step(): Snapshot {
    const old = this.state;
    if (old.complete) return old;
    const iteration = old.iteration + 1;
    const context = old.context;
    const decision = this.policy.selectAction(context.vector, old.available);
    const mutation = sampleMutation(
      this.candidates,
      decision.arm,
      this.config.seed,
      iteration,
    );
    const before = {
      accuracy: old.evaluation.accuracy,
      gates: old.size,
      depth: old.depth,
    };
    const proposal = evaluateCandidate(
      mutation,
      this.observations,
      before,
      this.config,
    );
    const oracle = this.config.oracle
      ? evaluateOracle(
          this.candidates,
          proposal,
          this.config.seed,
          iteration,
          this.observations,
          before,
          this.config,
        )
      : null;
    const accepted = acceptCandidate(
      before,
      proposal.quality,
      this.config.depthWeight,
    );
    const circuit = accepted ? mutation.circuit : old.circuit,
      evaluation = accepted ? proposal.evaluation : old.evaluation;
    const bestAccuracy = Math.max(
      old.bestAccuracy,
      proposal.evaluation.accuracy,
    );
    const previousBest = {
      accuracy: old.bestAccuracy,
      gates: gateCount(old.bestCircuit),
      depth: circuitDepth(old.bestCircuit),
    };
    const bestCircuit =
      proposal.evaluation.accuracy > old.bestAccuracy ||
      (proposal.evaluation.accuracy === old.bestAccuracy &&
        complexity(proposal.quality, this.config.depthWeight) <
          complexity(previousBest, this.config.depthWeight))
        ? mutation.circuit
        : old.bestCircuit;
    // Unselected oracle outcomes never reach the learner, best accuracy or features.
    this.policy.update(context.vector, decision.arm, proposal.reward);
    const { circuit: _candidate, ...mutationInfo } = mutation;
    const log: RoundLog = {
      iteration,
      mutation: mutationInfo,
      before: before.accuracy,
      after: proposal.quality.accuracy,
      reward: proposal.reward,
      accepted,
      reason: decision.reason,
      context: [...context.vector],
      predicted: decision.scores[decision.arm]?.mean ?? null,
      instantRegret: oracle?.instantRegret ?? null,
    };
    const cumulativeRegret = oracle
      ? (old.cumulativeRegret ?? 0) + oracle.instantRegret
      : null;
    const size = gateCount(circuit),
      depth = circuitDepth(circuit);
    const nodeActivity = Object.fromEntries(
      circuit.nodes.map((node) => [
        node.id,
        (old.nodeActivity[node.id] ?? 0) * 0.97 +
          (accepted && node.id === mutation.targetNode
            ? Math.max(0, proposal.reward) + 0.15
            : 0),
      ]),
    );
    const logs = [log, ...old.logs].slice(0, 80);
    const acceptedCount = old.acceptedCount + Number(accepted);
    const lastImprovementIteration =
      bestAccuracy > old.bestAccuracy
        ? iteration
        : old.lastImprovementIteration;
    const nextContext = extractContext(
      {
        circuit,
        evaluation,
        bestAccuracy,
        iteration,
        maxIterations: this.config.maxIterations,
        acceptedCount,
        lastImprovementIteration,
        recent: logs.map((row) => ({ ...row, arm: row.mutation.type })),
        observations: this.observations,
        rewardScale: this.scale,
      },
      this.config.contextMode,
    );
    this.state = {
      ...old,
      iteration,
      circuit,
      evaluation,
      bestAccuracy,
      bestCircuit,
      reward: proposal.reward,
      cumulativeReward: old.cumulativeReward + proposal.reward,
      cumulativeRegret,
      size,
      depth,
      stats: this.policy.getActionStats(),
      decision,
      last: log,
      logs,
      history: [
        ...old.history,
        {
          iteration,
          accuracy: evaluation.accuracy,
          reward: proposal.reward,
          regret: cumulativeRegret,
          size,
        },
      ].slice(-240),
      exploratoryCount: old.exploratoryCount + Number(decision.exploratory),
      acceptedCount,
      solvedAt: old.solvedAt ?? (evaluation.accuracy === 1 ? iteration : null),
      nodeActivity,
      lastImprovementIteration,
      context: nextContext,
      decisionContext: context,
      oracle,
      candidate: mutation.circuit,
      beforeCircuit: old.circuit,
      complete: iteration >= this.config.maxIterations,
    };
    if (accepted) {
      this.candidates = generateMutations(circuit);
      this.refreshAvailability();
    }
    return this.state;
  }
  advance(rounds: number): Snapshot {
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10000)
      throw new Error('Rounds must be an integer between 1 and 10000.');
    for (let i = 0; i < rounds && !this.state.complete; i++) this.step();
    return this.state;
  }
}
