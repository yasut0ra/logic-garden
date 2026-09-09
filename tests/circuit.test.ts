import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Random } from '../src/random';
import {
  GATE_TYPES,
  INPUT_IDS,
  circuitFromNodes,
  circuitDepth,
  gateCount,
  initialCircuit,
  pruneCircuit,
  validateCircuit,
  type Circuit,
  type LogicGate,
} from '../src/circuit/circuit';
import {
  ALL_INPUTS,
  evaluateCircuit,
  evaluateSignals,
  observe,
} from '../src/circuit/evaluator';
import {
  parseBoolean,
  targetObservations,
} from '../src/circuit/booleanFunctions';
import { ARMS, generateMutations } from '../src/circuit/mutations';
function singleGate(type: LogicGate): Circuit {
  return circuitFromNodes([
    ...INPUT_IDS.map((id) => ({ id, type: 'INPUT' as const, inputs: [] })),
    { id: 'g1', type, inputs: type === 'NOT' ? ['A'] : ['A', 'B'] },
    { id: 'Y', type: 'OUTPUT', inputs: ['g1'] },
  ]);
}
void test('all six gates match their complete truth tables', () => {
  const expected = {
    AND: '00000011',
    OR: '00111111',
    XOR: '00111100',
    NAND: '11111100',
    NOR: '11000000',
    NOT: '11110000',
  };
  for (const type of GATE_TYPES) {
    const circuit = singleGate(type);
    assert.equal(validateCircuit(circuit), null);
    assert.equal(
      ALL_INPUTS.map((input) => evaluateSignals(circuit, input).Y).join(''),
      expected[type],
    );
  }
});
void test('parser precedence, parentheses, aliases and constants', () => {
  assert.deepEqual(
    observe(parseBoolean('!A & B | C')),
    observe(parseBoolean('((NOT A) AND B) OR C')),
  );
  assert.deepEqual(
    observe(parseBoolean('A XOR B AND C')),
    observe(parseBoolean('A XOR (B AND C)')),
  );
  assert.deepEqual(
    observe(parseBoolean('A || B && !C')),
    observe(parseBoolean('A OR (B AND (NOT C))')),
  );
  assert.equal(
    observe(parseBoolean('(A XOR B) AND C'))
      .map((r) => r.expected)
      .join(''),
    '00010100',
  );
  assert.ok(
    observe(parseBoolean('A NAND A')).every(
      (r) => r.expected === 1 - r.input[0],
    ),
  );
  assert.ok(observe(parseBoolean('0 NOR 0')).every((r) => r.expected === 1));
  for (const source of [
    '',
    'A B',
    'D',
    'A + B',
    '(A OR B',
    'A AND',
    'A;alert(1)',
    'globalThis',
    'A'.repeat(301),
  ])
    assert.throws(() => parseBoolean(source), source);
});
void test('accuracy is deterministic over all eight oracle observations', () => {
  const circuit = singleGate('XOR');
  assert.equal(
    evaluateCircuit(circuit, observe(parseBoolean('A XOR B'))).accuracy,
    1,
  );
  assert.equal(
    evaluateCircuit(circuit, observe(parseBoolean('A AND B'))).accuracy,
    0.25,
  );
  assert.throws(() => evaluateCircuit(circuit, []));
  assert.deepEqual(
    targetObservations('random', 42, ''),
    targetObservations('random', 42, ''),
  );
  assert.equal(
    targetObservations('majority', 42, '')
      .map((row) => row.expected)
      .join(''),
    '00010111',
  );
});
void test('validator rejects cycles, dangling wires, invalid arity and duplicate nodes', () => {
  const circuit = initialCircuit();
  assert.equal(validateCircuit(circuit), null);
  const cyclic = circuitFromNodes(
    circuit.nodes.map((n) =>
      n.id === 'g1' ? { ...n, inputs: ['g2', 'B'] } : n,
    ),
  );
  assert.match(validateCircuit(cyclic)!, /Cycle/);
  const dangling = circuitFromNodes(
    circuit.nodes.map((n) =>
      n.id === 'g1' ? { ...n, inputs: ['missing', 'B'] } : n,
    ),
  );
  assert.ok(validateCircuit(dangling));
  const wrongArity = circuitFromNodes(
    circuit.nodes.map((n) =>
      n.id === 'g1' ? { ...n, type: 'NOT' as const } : n,
    ),
  );
  assert.ok(validateCircuit(wrongArity));
  assert.ok(
    validateCircuit(circuitFromNodes([...circuit.nodes, circuit.nodes[0]!])),
  );
  assert.ok(validateCircuit({ ...circuit, edges: [] }));
});
void test('hundreds of reachable mutation sets preserve all circuit invariants', () => {
  const rng = new Random(42),
    categories = new Set<string>();
  let circuit = initialCircuit();
  for (let round = 0; round < 120; round++) {
    const candidates = generateMutations(circuit);
    for (const arm of ARMS)
      for (const mutation of candidates[arm]) {
        categories.add(arm);
        assert.equal(
          validateCircuit(mutation.circuit),
          null,
          mutation.description,
        );
        assert.ok(gateCount(mutation.circuit) <= 8);
        assert.ok(circuitDepth(mutation.circuit) <= 5);
        assert.deepEqual(pruneCircuit(mutation.circuit), mutation.circuit);
        assert.notDeepEqual(mutation.circuit, circuit);
        assert.equal(mutation.type, arm);
      }
    const available = ARMS.filter((arm) => candidates[arm].length);
    circuit = rng.pick(candidates[rng.pick(available)]).circuit;
  }
  assert.deepEqual([...categories].sort(), [...ARMS].sort());
});
void test('mutation generation leaves its source untouched', () => {
  const circuit = initialCircuit(),
    before = structuredClone(circuit);
  for (const node of circuit.nodes) {
    Object.freeze(node.inputs);
    Object.freeze(node);
  }
  Object.freeze(circuit.nodes);
  Object.freeze(circuit.edges);
  Object.freeze(circuit);
  generateMutations(circuit);
  assert.deepEqual(circuit, before);
});

void test('OR, three-bit parity and multiplexer presets match all eight observations', () => {
  for (const id of ['or', 'parity', 'multiplexer'] as const) {
    const observations = targetObservations(id, 42, '');
    for (const row of observations) {
      const [a, b, c] = row.input;
      assert.equal(
        row.expected,
        id === 'or' ? a | b : id === 'parity' ? a ^ b ^ c : c ? b : a,
      );
    }
  }
});
