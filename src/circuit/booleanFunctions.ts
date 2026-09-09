import { Random } from '../random';
import type { Bit, Input } from './circuit';
import { observe, type Observation, type Oracle } from './evaluator';
export const PRESETS = [
  { id: 'xor', label: 'A XOR B', expression: 'A XOR B' },
  { id: 'and', label: 'A AND B', expression: 'A AND B' },
  { id: 'xor-and', label: '(A XOR B) AND C', expression: '(A XOR B) AND C' },
  { id: 'and-or', label: '(A AND B) OR C', expression: '(A AND B) OR C' },
  {
    id: 'majority',
    label: 'Majority(A, B, C)',
    expression: '(A AND B) OR (A AND C) OR (B AND C)',
  },
  { id: 'random', label: 'Random Boolean function', expression: '' },
  { id: 'custom', label: 'Custom expression…', expression: '' },
] as const;
export type TargetId = (typeof PRESETS)[number]['id'];

/** Recursive descent parser, not eval/Function. Precedence: NOT > AND/NAND > XOR > OR/NOR. */
export function parseBoolean(source: string): Oracle {
  if (!source.trim() || source.length > 300)
    throw new Error('Enter a Boolean expression of 1–300 characters.');
  const tokens = source
    .toUpperCase()
    .match(
      /\s+|AND\b|NAND\b|XOR\b|NOR\b|NOT\b|OR\b|[ABC01()]|&&?|\|\|?|\^|!|./g,
    )!
    .filter((t) => !/^\s+$/.test(t));
  let pos = 0;
  const peek = () => tokens[pos];
  function atom(): Oracle {
    const token = tokens[pos++];
    if (token === 'NOT' || token === '!') {
      const child = atom();
      return (x) => (1 - child(x)) as Bit;
    }
    if (token === '(') {
      const child = expression(0);
      if (tokens[pos++] !== ')')
        throw new Error('Missing closing parenthesis.');
      return child;
    }
    if (token === '0' || token === '1') return () => Number(token) as Bit;
    if (token === 'A' || token === 'B' || token === 'C')
      return (x) => x[token === 'A' ? 0 : token === 'B' ? 1 : 2];
    throw new Error(
      `Expected A, B, C, 0, 1, NOT or “(”; found ${token ?? 'end of expression'}.`,
    );
  }
  const precedence: Record<string, number> = {
    OR: 1,
    NOR: 1,
    '|': 1,
    '||': 1,
    XOR: 2,
    '^': 2,
    AND: 3,
    NAND: 3,
    '&': 3,
    '&&': 3,
  };
  function expression(min: number): Oracle {
    let left = atom();
    while (peek() && (precedence[peek()!] ?? -1) >= min) {
      const op = tokens[pos++]!,
        right = expression(precedence[op]! + 1),
        previous = left;
      left = (x: Input): Bit => {
        const a = previous(x),
          b = right(x);
        if (op === 'AND' || op === '&' || op === '&&') return (a & b) as Bit;
        if (op === 'NAND') return (1 - (a & b)) as Bit;
        if (op === 'XOR' || op === '^') return (a ^ b) as Bit;
        if (op === 'NOR') return (1 - (a | b)) as Bit;
        return (a | b) as Bit;
      };
    }
    return left;
  }
  const fn = expression(0);
  if (pos !== tokens.length) throw new Error(`Unexpected token “${peek()}”.`);
  return fn;
}
export function targetObservations(
  id: TargetId,
  seed: number,
  custom: string,
): Observation[] {
  if (id === 'random') {
    const rng = new Random(seed ^ 0x91e10da5);
    const table = Array.from(
      { length: 8 },
      () => (rng.next() < 0.5 ? 0 : 1) as Bit,
    );
    return observe((x) => table[x[0] * 4 + x[1] * 2 + x[2]]!);
  }
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error('Unknown target function.');
  return observe(parseBoolean(id === 'custom' ? custom : preset.expression));
}
