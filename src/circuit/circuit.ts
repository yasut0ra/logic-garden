export const GATE_TYPES = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT'] as const;
export type LogicGate = (typeof GATE_TYPES)[number];
export type GateType = 'INPUT' | LogicGate | 'OUTPUT';
export type Bit = 0 | 1;
export type Input = readonly [Bit, Bit, Bit];
export interface CircuitNode {
  id: string;
  type: GateType;
  inputs: string[];
}
export interface CircuitEdge {
  source: string;
  target: string;
  port: number;
}
export interface Circuit {
  nodes: CircuitNode[];
  edges: CircuitEdge[];
}
export const MAX_GATES = 6;
export const MAX_DEPTH = 3;
export const INPUT_IDS = ['A', 'B', 'C'] as const;
export const isGate = (node: CircuitNode) =>
  node.type !== 'INPUT' && node.type !== 'OUTPUT';
export const gateCount = (circuit: Circuit) =>
  circuit.nodes.filter(isGate).length;
export const arity = (type: GateType) =>
  type === 'INPUT' ? 0 : type === 'OUTPUT' || type === 'NOT' ? 1 : 2;

/** Nodes are stored in topological order; edges are derived to avoid divergent state. */
export function circuitFromNodes(nodes: CircuitNode[]): Circuit {
  return {
    nodes,
    edges: nodes.flatMap((node) =>
      node.inputs.map((source, port) => ({ source, target: node.id, port })),
    ),
  };
}
export function nodeDepths(circuit: Circuit): Record<string, number> {
  const depths: Record<string, number> = {};
  for (const node of circuit.nodes)
    depths[node.id] =
      node.type === 'INPUT'
        ? 0
        : Math.max(...node.inputs.map((id) => depths[id]!)) +
          (node.type === 'OUTPUT' ? 0 : 1);
  return depths;
}
export function circuitDepth(circuit: Circuit): number {
  return nodeDepths(circuit).Y!;
}
export function validateCircuit(circuit: Circuit): string | null {
  const seen = new Set<string>();
  for (const node of circuit.nodes) {
    if (seen.has(node.id)) return 'Duplicate node ID.';
    if (!['INPUT', 'OUTPUT', ...GATE_TYPES].includes(node.type))
      return 'Unknown gate.';
    if (node.inputs.length !== arity(node.type)) return 'Incorrect gate arity.';
    if (node.inputs.some((id) => !seen.has(id) || id === 'Y'))
      return 'Cycle, dangling edge, or invalid topological order.';
    seen.add(node.id);
  }
  if (
    circuit.nodes.filter((n) => n.type === 'INPUT').length !== 3 ||
    INPUT_IDS.some(
      (id) => !circuit.nodes.some((n) => n.id === id && n.type === 'INPUT'),
    )
  )
    return 'Expected inputs A, B, C.';
  if (
    circuit.nodes.filter((n) => n.type === 'OUTPUT').length !== 1 ||
    circuit.nodes.at(-1)?.id !== 'Y' ||
    circuit.nodes.at(-1)?.type !== 'OUTPUT'
  )
    return 'Expected final output Y.';
  if (gateCount(circuit) > MAX_GATES || circuitDepth(circuit) > MAX_DEPTH)
    return 'Circuit budget exceeded.';
  if (
    JSON.stringify(circuit.edges) !==
    JSON.stringify(circuitFromNodes(circuit.nodes).edges)
  )
    return 'Edges do not match node inputs.';
  return null;
}
/** Delete disconnected gates, retaining all three input terminals. */
export function pruneCircuit(circuit: Circuit): Circuit {
  const needed = new Set(['Y', ...INPUT_IDS]);
  for (const node of [...circuit.nodes].reverse())
    if (needed.has(node.id)) node.inputs.forEach((id) => needed.add(id));
  return circuitFromNodes(circuit.nodes.filter((node) => needed.has(node.id)));
}
export function initialCircuit(): Circuit {
  return circuitFromNodes([
    ...INPUT_IDS.map((id) => ({ id, type: 'INPUT' as const, inputs: [] })),
    { id: 'g1', type: 'NAND', inputs: ['A', 'B'] },
    { id: 'g2', type: 'OR', inputs: ['g1', 'C'] },
    { id: 'Y', type: 'OUTPUT', inputs: ['g2'] },
  ]);
}
export function circuitExpression(circuit: Circuit): string {
  const expressions: Record<string, string> = {};
  for (const node of circuit.nodes) {
    const args = node.inputs.map((id) => expressions[id]);
    expressions[node.id] =
      node.type === 'INPUT'
        ? node.id
        : node.type === 'OUTPUT'
          ? args[0]!
          : node.type === 'NOT'
            ? `NOT(${args[0]})`
            : `(${args[0]} ${node.type} ${args[1]})`;
  }
  return expressions.Y!;
}
