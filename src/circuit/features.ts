import {
  GATE_TYPES,
  MAX_DEPTH,
  MAX_GATES,
  circuitDepth,
  gateCount,
  isGate,
  type Circuit,
} from './circuit';
import { ARMS, type Arm } from './mutations';
import type { Evaluation, Observation } from './evaluator';
export const CONTEXT_MODES = [
  'structural',
  'performance-structural',
  'full',
] as const;
export type ContextMode = (typeof CONTEXT_MODES)[number];
export const CONTEXT_LABELS: Record<ContextMode, string> = {
  structural: 'Structural · 12D',
  'performance-structural': 'Performance + structure · 18D',
  full: 'Full + error pattern · 35D',
};
export type FeatureGroup =
  | 'bias'
  | 'performance'
  | 'structure'
  | 'search'
  | 'error';
export interface Feature {
  key: string;
  label: string;
  group: FeatureGroup;
  value: number;
  raw: number;
  definition: string;
}
export interface Context {
  mode: ContextMode;
  iteration: number;
  features: Feature[];
  vector: number[];
}
export interface RecentOutcome {
  arm: Arm;
  before: number;
  after: number;
  reward: number;
  accepted: boolean;
}
export interface FeatureState {
  circuit: Circuit;
  evaluation: Evaluation;
  bestAccuracy: number;
  iteration: number;
  maxIterations: number;
  acceptedCount: number;
  lastImprovementIteration: number;
  recent: readonly RecentOutcome[];
  observations: readonly Observation[];
  rewardScale: number;
}
export const FEATURE_WINDOW = 32;
const clip = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
/** Features use only the current circuit and observations available BEFORE selection.
 * No target AST, pending candidate, or counterfactual oracle result enters this boundary.
 */
export function extractContext(
  state: FeatureState,
  mode: ContextMode,
): Context {
  const features: Feature[] = [];
  const add = (
    key: string,
    label: string,
    group: FeatureGroup,
    raw: number,
    value: number,
    definition: string,
  ) => features.push({ key, label, group, raw, value, definition });
  add(
    'bias',
    'bias',
    'bias',
    1,
    1,
    'Constant intercept, regularized with the other coefficients.',
  );
  const recent = state.recent.slice(0, FEATURE_WINDOW);
  const scale = Math.max(state.rewardScale, Number.EPSILON);
  const current = state.evaluation.accuracy;
  add(
    'accuracy',
    'accuracy',
    'performance',
    current,
    current,
    'Current correct / 8.',
  );
  add(
    'best_accuracy',
    'best accuracy',
    'performance',
    state.bestAccuracy,
    state.bestAccuracy,
    'Best accuracy among selected proposals; excludes oracle alternatives.',
  );
  const improvement = recent.length ? current - recent.at(-1)!.before : 0;
  add(
    'recent_improvement',
    'recent improvement',
    'performance',
    improvement,
    clip(improvement, -1, 1),
    'Current accuracy minus accuracy before the oldest of the last 32 selected proposals.',
  );
  const reward = recent[0]?.reward ?? 0;
  add(
    'recent_reward',
    'recent reward',
    'performance',
    reward,
    clip(reward / scale, -1, 1),
    'Last selected candidate reward / fixed reward bound. Signed, not shifted.',
  );
  const average = recent.length
    ? recent.reduce((sum, row) => sum + row.reward, 0) / recent.length
    : 0;
  add(
    'mean_reward',
    'moving mean reward',
    'performance',
    average,
    clip(average / scale, -1, 1),
    'Mean of the last 32 selected rewards / reward bound.',
  );
  const stagnation = state.iteration - state.lastImprovementIteration;
  add(
    'stagnation',
    'stagnation',
    'performance',
    stagnation,
    clip(stagnation / state.maxIterations),
    'Rounds since a selected proposal improved best accuracy / iteration budget.',
  );
  const gates = gateCount(state.circuit),
    depth = circuitDepth(state.circuit);
  add(
    'gate_ratio',
    'gate ratio',
    'structure',
    gates,
    gates / MAX_GATES,
    `Reachable logic gates / ${MAX_GATES}.`,
  );
  add(
    'depth_ratio',
    'depth ratio',
    'structure',
    depth,
    depth / MAX_DEPTH,
    `Logic depth / ${MAX_DEPTH}, excluding terminals.`,
  );
  for (const type of GATE_TYPES) {
    const count = state.circuit.nodes.filter(
      (node) => node.type === type,
    ).length;
    add(
      `${type.toLowerCase()}_ratio`,
      `${type} ratio`,
      'structure',
      count,
      count / MAX_GATES,
      `${type} gates / ${MAX_GATES}.`,
    );
  }
  add(
    'edge_ratio',
    'edge ratio',
    'structure',
    state.circuit.edges.length,
    state.circuit.edges.length / (2 * MAX_GATES + 1),
    'Input slots including the output wire / maximum 17 edges.',
  );
  const fanIn = gates
    ? state.circuit.nodes
        .filter(isGate)
        .reduce((sum, node) => sum + node.inputs.length, 0) / gates
    : 0;
  add(
    'fan_in',
    'average fan-in',
    'structure',
    fanIn,
    fanIn / 2,
    'Average logic-gate input count / 2; zero for a wire-only circuit.',
  );
  const reachable = new Set(['Y']);
  for (const node of [...state.circuit.nodes].reverse())
    if (reachable.has(node.id)) node.inputs.forEach((id) => reachable.add(id));
  const unused =
    state.circuit.nodes.filter((node) => !reachable.has(node.id)).length /
    state.circuit.nodes.length;
  add(
    'unused_ratio',
    'unused node ratio',
    'structure',
    unused,
    unused,
    'Nodes not feeding Y / all nodes. Includes unused input terminals; disconnected gates are pruned.',
  );
  add(
    'progress',
    'budget progress',
    'search',
    state.iteration,
    clip(state.iteration / state.maxIterations),
    'Completed rounds / the fixed iteration budget.',
  );
  const accepted = state.iteration ? state.acceptedCount / state.iteration : 0;
  add(
    'accepted_ratio',
    'accepted ratio',
    'search',
    accepted,
    accepted,
    'Accepted selected candidates / completed rounds.',
  );
  const rejected = state.iteration ? 1 - accepted : 0;
  add(
    'rejected_ratio',
    'rejected ratio',
    'search',
    rejected,
    rejected,
    'Rejected selected candidates / completed rounds.',
  );
  for (const arm of ARMS) {
    const rows = recent.filter((row) => row.arm === arm);
    const success = rows.length
      ? rows.filter((row) => row.after > row.before).length / rows.length
      : 0;
    add(
      `${arm}_success`,
      `${arm} success`,
      'search',
      success,
      success,
      'Accuracy-improving proposals of this category / its proposals in the last 32 rounds; zero when unobserved.',
    );
  }
  for (let row = 0; row < 8; row++) {
    const error = Number(
      state.evaluation.predicted[row] !== state.observations[row]!.expected,
    );
    add(
      `error_${row.toString(2).padStart(3, '0')}`,
      `error ${row.toString(2).padStart(3, '0')}`,
      'error',
      error,
      error,
      '1 when the CURRENT circuit predicts this observed input incorrectly.',
    );
  }
  const selected = features.filter(
    (feature) =>
      feature.group === 'bias' ||
      feature.group === 'structure' ||
      (mode !== 'structural' && feature.group === 'performance') ||
      mode === 'full',
  );
  if (selected.some((feature) => !Number.isFinite(feature.value)))
    throw new Error('Non-finite context feature.');
  return {
    mode,
    iteration: state.iteration,
    features: selected,
    vector: selected.map((feature) => feature.value),
  };
}
