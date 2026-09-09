import { Random } from '../random';
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
  freshStats,
  normalizeReward,
  selectArm,
  updateStats,
  type Algorithm,
  type BanditStats,
  type Decision,
} from '../algorithms/bandit';
export interface SimulationConfig {
  seed: number;
  algorithm: Algorithm;
  epsilon: number;
  penalty: number;
}
export const DEFAULT_CONFIG: SimulationConfig = {
  seed: 42,
  algorithm: 'ucb1',
  epsilon: 0.15,
  penalty: 0,
};
export interface HistoryPoint {
  iteration: number;
  accuracy: number;
  reward: number;
  regret: number;
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
}
export interface Snapshot {
  iteration: number;
  circuit: Circuit;
  evaluation: Evaluation;
  bestAccuracy: number;
  bestCircuit: Circuit;
  reward: number;
  cumulativeReward: number;
  cumulativeRegret: number;
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
}
/** Stateful coordinator; algorithms, evaluation, and mutation generation are independent.
 * No timer, React dependency, target AST, or wall-clock randomness enters the engine.
 */
export class Simulator {
  readonly config: SimulationConfig;
  readonly observations: readonly Observation[];
  private selectionRng: Random;
  private mutationRng: Random;
  private posteriorRng: Random;
  private candidates: Candidates | null = null;
  private state: Snapshot;
  constructor(config: SimulationConfig, observations: readonly Observation[]) {
    if (
      !Number.isInteger(config.seed) ||
      config.seed < 0 ||
      config.seed > 0xffffffff
    )
      throw new Error('Seed must be a uint32 integer.');
    if (
      !Number.isFinite(config.epsilon) ||
      config.epsilon < 0 ||
      config.epsilon > 1 ||
      ![0, 0.01].includes(config.penalty)
    )
      throw new Error('Invalid simulation settings.');
    if (!['epsilon-greedy', 'ucb1', 'thompson'].includes(config.algorithm))
      throw new Error('Unknown algorithm.');
    this.config = { ...config };
    this.observations = observations.map((row) => ({
      ...row,
      input: [...row.input] as typeof row.input,
    }));
    this.selectionRng = new Random(config.seed ^ 0xa341316c);
    this.mutationRng = new Random(config.seed ^ 0xc8013ea4);
    this.posteriorRng = new Random(config.seed ^ 0xad90777d);
    const circuit = initialCircuit(),
      evaluation = evaluateCircuit(circuit, this.observations);
    this.state = {
      iteration: 0,
      circuit,
      evaluation,
      bestAccuracy: evaluation.accuracy,
      bestCircuit: circuit,
      reward: 0,
      cumulativeReward: 0,
      cumulativeRegret: 0,
      size: gateCount(circuit),
      depth: circuitDepth(circuit),
      stats: freshStats(),
      decision: null,
      last: null,
      logs: [],
      history: [
        {
          iteration: 0,
          accuracy: evaluation.accuracy,
          reward: 0,
          regret: 0,
          size: gateCount(circuit),
        },
      ],
      available: [],
      candidateCounts: {} as Record<Arm, number>,
      exploratoryCount: 0,
      acceptedCount: 0,
      solvedAt: evaluation.accuracy === 1 ? 0 : null,
      nodeActivity: {},
    };
    this.refreshCandidates();
  }
  private refreshCandidates() {
    this.candidates = generateMutations(this.state.circuit);
    this.state = {
      ...this.state,
      available: ARMS.filter((arm) => this.candidates![arm].length > 0),
      candidateCounts: Object.fromEntries(
        ARMS.map((arm) => [arm, this.candidates![arm].length]),
      ) as Record<Arm, number>,
    };
  }
  snapshot(): Snapshot {
    return this.state;
  }
  step(): Snapshot {
    if (!this.candidates) this.refreshCandidates();
    const old = this.state;
    const decision = selectArm(
      this.config.algorithm,
      old.stats,
      old.available,
      this.selectionRng,
      this.config.epsilon,
    );
    const mutation = this.mutationRng.pick(this.candidates![decision.arm]);
    const proposed = evaluateCircuit(mutation.circuit, this.observations);
    const reward =
      proposed.accuracy -
      old.evaluation.accuracy -
      this.config.penalty * (gateCount(mutation.circuit) - old.size);
    const accepted = reward >= -1e-12; // Neutral moves permit drift across accuracy plateaus.
    const circuit = accepted ? mutation.circuit : old.circuit;
    const evaluation = accepted ? proposed : old.evaluation;
    const bestAccuracy = Math.max(old.bestAccuracy, proposed.accuracy);
    const bestCircuit =
      proposed.accuracy > old.bestAccuracy ||
      (proposed.accuracy === old.bestAccuracy &&
        gateCount(mutation.circuit) < gateCount(old.bestCircuit))
        ? mutation.circuit
        : old.bestCircuit;
    const iteration = old.iteration + 1;
    const cumulativeRegret =
      old.cumulativeRegret + bestAccuracy - evaluation.accuracy;
    const { circuit: _proposal, ...mutationInfo } = mutation;
    const log: RoundLog = {
      iteration,
      mutation: mutationInfo,
      before: old.evaluation.accuracy,
      after: proposed.accuracy,
      reward,
      accepted,
      reason: decision.reason,
    };
    const size = gateCount(circuit);
    const nodeActivity = Object.fromEntries(
      circuit.nodes.map((n) => [
        n.id,
        (old.nodeActivity[n.id] ?? 0) * 0.97 +
          (accepted && n.id === mutation.targetNode
            ? Math.max(0, reward) + 0.15
            : 0),
      ]),
    );
    this.state = {
      ...old,
      iteration,
      circuit,
      evaluation,
      bestAccuracy,
      bestCircuit,
      reward,
      cumulativeReward: old.cumulativeReward + reward,
      cumulativeRegret,
      size,
      depth: circuitDepth(circuit),
      stats: updateStats(
        old.stats,
        decision.arm,
        reward,
        normalizeReward(reward, this.config.penalty),
        this.posteriorRng,
      ),
      decision,
      last: log,
      logs: [log, ...old.logs].slice(0, 80),
      history: [
        ...old.history,
        {
          iteration,
          accuracy: evaluation.accuracy,
          reward,
          regret: cumulativeRegret,
          size,
        },
      ].slice(-240),
      exploratoryCount: old.exploratoryCount + Number(decision.exploratory),
      acceptedCount: old.acceptedCount + Number(accepted),
      solvedAt: old.solvedAt ?? (evaluation.accuracy === 1 ? iteration : null),
      nodeActivity,
    };
    if (accepted) {
      this.candidates = null;
      this.refreshCandidates();
    }
    return this.state;
  }
  advance(rounds: number): Snapshot {
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10000)
      throw new Error('Rounds must be an integer between 1 and 10000.');
    for (let i = 0; i < rounds; i++) this.step();
    return this.state;
  }
}
