import type { Bit, Circuit, Input } from './circuit';
export type Oracle = (input: Input) => Bit;
export const ALL_INPUTS: Input[] = Array.from({ length: 8 }, (_, i) => [
  ((i >> 2) & 1) as Bit,
  ((i >> 1) & 1) as Bit,
  (i & 1) as Bit,
]);
export interface Observation {
  input: Input;
  expected: Bit;
}
export interface Evaluation {
  accuracy: number;
  predicted: Bit[];
  correct: number;
}
export function evaluateSignals(
  circuit: Circuit,
  input: Input,
): Record<string, Bit> {
  const values: Record<string, Bit> = { A: input[0], B: input[1], C: input[2] };
  for (const node of circuit.nodes) {
    const a = values[node.inputs[0]!]!,
      b = values[node.inputs[1]!]!;
    switch (node.type) {
      case 'INPUT':
        break;
      case 'AND':
        values[node.id] = (a & b) as Bit;
        break;
      case 'OR':
        values[node.id] = (a | b) as Bit;
        break;
      case 'XOR':
        values[node.id] = (a ^ b) as Bit;
        break;
      case 'NAND':
        values[node.id] = (1 - (a & b)) as Bit;
        break;
      case 'NOR':
        values[node.id] = (1 - (a | b)) as Bit;
        break;
      case 'NOT':
        values[node.id] = (1 - a) as Bit;
        break;
      case 'OUTPUT':
        values[node.id] = a;
        break;
    }
  }
  return values;
}
/** Evaluation consumes observations only, never the target expression. */
export function evaluateCircuit(
  circuit: Circuit,
  observations: readonly Observation[],
): Evaluation {
  if (!observations.length)
    throw new Error('At least one observation is required.');
  const predicted = observations.map(
    ({ input }) => evaluateSignals(circuit, input).Y!,
  );
  const correct = predicted.reduce<number>(
    (sum, bit, i) => sum + Number(bit === observations[i]!.expected),
    0,
  );
  return { accuracy: correct / observations.length, predicted, correct };
}
export const observe = (oracle: Oracle): Observation[] =>
  ALL_INPUTS.map((input) => ({ input, expected: oracle(input) }));
