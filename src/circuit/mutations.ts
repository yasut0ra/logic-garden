import {
  arity,
  circuitFromNodes,
  GATE_TYPES,
  isGate,
  pruneCircuit,
  validateCircuit,
  type Circuit,
  type CircuitNode,
} from './circuit';
export const ARMS = [
  'change_gate',
  'add_gate',
  'remove_gate',
  'rewire',
  'add_not',
  'remove_not',
] as const;
export type Arm = (typeof ARMS)[number];
export const ARM_LABELS: Record<Arm, string> = {
  change_gate: 'change gate',
  add_gate: 'add gate',
  remove_gate: 'remove gate',
  rewire: 'rewire edge',
  add_not: 'add NOT',
  remove_not: 'remove NOT',
};
export interface Mutation {
  type: Arm;
  targetNode: string;
  before: string;
  after: string;
  description: string;
  circuit: Circuit;
}
export type Candidates = Record<Arm, Mutation[]>;
const signature = (c: Circuit) => JSON.stringify(c.nodes);

/** Enumerate legal structural candidates without querying accuracy or the oracle.
 * The bandit chooses a nonempty category BEFORE a candidate is randomly sampled.
 * Topological insertion + validation enforce acyclicity, arity, size and depth.
 */
export function generateMutations(circuit: Circuit): Candidates {
  const result = Object.fromEntries(
    ARMS.map((arm) => [arm, []]),
  ) as unknown as Candidates;
  const seen = Object.fromEntries(
    ARMS.map((arm) => [arm, new Set<string>()]),
  ) as Record<Arm, Set<string>>;
  const original = signature(circuit);
  const nextId = `g${1 + Math.max(0, ...circuit.nodes.map((n) => Number(n.id.replace(/^g/, '')) || 0))}`;
  function add(
    type: Arm,
    targetNode: string,
    before: string,
    after: string,
    nodes: CircuitNode[],
  ) {
    const candidate = pruneCircuit(circuitFromNodes(nodes));
    if (validateCircuit(candidate)) return;
    const key = signature(candidate);
    if (key === original || seen[type].has(key)) return;
    seen[type].add(key);
    result[type].push({
      type,
      targetNode,
      before,
      after,
      description: `${targetNode}: ${before} → ${after}`,
      circuit: candidate,
    });
  }
  const replace = (id: string, patch: Partial<CircuitNode>) =>
    circuit.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));
  circuit.nodes.forEach((node, index) => {
    if (node.type === 'INPUT') return;
    const sources = circuit.nodes.slice(0, index).map((n) => n.id);
    if (isGate(node)) {
      for (const type of GATE_TYPES) {
        if (type === node.type) continue;
        const inputSets =
          arity(type) === 1
            ? [...new Set(node.inputs)].map((id) => [id])
            : node.inputs.length === 1
              ? sources.map((id) => [node.inputs[0]!, id])
              : [node.inputs];
        for (const inputs of inputSets)
          add(
            'change_gate',
            node.id,
            node.type,
            type,
            replace(node.id, { type, inputs }),
          );
      }
      for (const source of new Set(node.inputs)) {
        add(
          node.type === 'NOT' ? 'remove_not' : 'remove_gate',
          node.id,
          node.type,
          `bypass ${source}`,
          circuit.nodes
            .filter((n) => n.id !== node.id)
            .map((n) => ({
              ...n,
              inputs: n.inputs.map((id) => (id === node.id ? source : id)),
            })),
        );
      }
    }
    node.inputs.forEach((source, port) => {
      for (const other of sources)
        if (other !== source)
          add(
            'rewire',
            node.id,
            `${source} [${port}]`,
            `${other} [${port}]`,
            replace(node.id, {
              inputs: node.inputs.map((id, p) => (p === port ? other : id)),
            }),
          );
      for (const type of GATE_TYPES) {
        for (const second of type === 'NOT' ? [source] : sources) {
          const nodes = [
            ...circuit.nodes.slice(0, index),
            {
              id: nextId,
              type,
              inputs: type === 'NOT' ? [source] : [source, second],
            },
            {
              ...node,
              inputs: node.inputs.map((id, p) => (p === port ? nextId : id)),
            },
            ...circuit.nodes.slice(index + 1),
          ];
          add(
            type === 'NOT' ? 'add_not' : 'add_gate',
            nextId,
            `${source} → ${node.id}`,
            `${type} → ${node.id}`,
            nodes,
          );
        }
      }
    });
  });
  return result;
}
