import type { Random } from '../../random';
export const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((sum, value, i) => sum + value * b[i]!, 0);
/** Disjoint ridge model. A = L Lᵀ is maintained by O(d²) Cholesky rank-one updates.
 * Triangular solves replace explicit inversion; regularization guarantees SPD.
 */
export class LinearModel {
  private factor: number[][];
  private gram: number[][];
  private response: number[];
  private weights: number[];
  constructor(
    readonly dimension: number,
    readonly ridge: number,
  ) {
    if (
      !Number.isInteger(dimension) ||
      dimension < 1 ||
      !Number.isFinite(ridge) ||
      ridge <= 0
    )
      throw new Error('Positive dimension and ridge are required.');
    this.gram = Array.from({ length: dimension }, (_, i) =>
      Array.from({ length: dimension }, (_, j) => (i === j ? ridge : 0)),
    );
    this.factor = this.gram.map((row, i) =>
      row.map((_, j) => (i === j ? Math.sqrt(ridge) : 0)),
    );
    this.response = Array(dimension).fill(0) as number[];
    this.weights = [...this.response];
  }
  private validate(context: readonly number[]) {
    if (
      context.length !== this.dimension ||
      context.some((value) => !Number.isFinite(value))
    )
      throw new Error('Invalid context dimension or non-finite value.');
  }
  private lowerSolve(rhs: readonly number[]): number[] {
    const result = Array(this.dimension).fill(0) as number[];
    for (let i = 0; i < this.dimension; i++) {
      let sum = rhs[i]!;
      for (let j = 0; j < i; j++) sum -= this.factor[i]![j]! * result[j]!;
      result[i] = sum / this.factor[i]![i]!;
    }
    return result;
  }
  private upperSolve(rhs: readonly number[]): number[] {
    const result = Array(this.dimension).fill(0) as number[];
    for (let i = this.dimension - 1; i >= 0; i--) {
      let sum = rhs[i]!;
      for (let j = i + 1; j < this.dimension; j++)
        sum -= this.factor[j]![i]! * result[j]!;
      result[i] = sum / this.factor[i]![i]!;
    }
    return result;
  }
  predict(context: readonly number[]): { mean: number; uncertainty: number } {
    this.validate(context);
    const projected = this.lowerSolve(context);
    return {
      mean: dot(context, this.weights),
      uncertainty: Math.sqrt(Math.max(0, dot(projected, projected))),
    };
  }
  sampleWeights(rng: Random, scale: number): number[] {
    const noise = this.upperSolve(
      Array.from({ length: this.dimension }, () => rng.normal()),
    );
    return this.weights.map((weight, i) => weight + scale * noise[i]!);
  }
  update(context: readonly number[], reward: number): void {
    this.validate(context);
    if (!Number.isFinite(reward)) throw new Error('Reward must be finite.');
    const rankVector = [...context];
    for (let i = 0; i < this.dimension; i++) {
      this.response[i]! += reward * context[i]!;
      for (let j = 0; j < this.dimension; j++)
        this.gram[i]![j]! += context[i]! * context[j]!;
      const diagonal = this.factor[i]![i]!;
      const next = Math.hypot(diagonal, rankVector[i]!);
      const c = next / diagonal,
        s = rankVector[i]! / diagonal;
      this.factor[i]![i] = next;
      for (let j = i + 1; j < this.dimension; j++) {
        this.factor[j]![i] = (this.factor[j]![i]! + s * rankVector[j]!) / c;
        rankVector[j] = c * rankVector[j]! - s * this.factor[j]![i]!;
      }
    }
    this.weights = this.upperSolve(this.lowerSolve(this.response));
    if (this.weights.some((value) => !Number.isFinite(value)))
      throw new Error('Linear model lost numerical stability.');
  }
  coefficients(): number[] {
    return [...this.weights];
  }
  parameters() {
    return {
      A: this.gram.map((row) => [...row]),
      b: [...this.response],
      L: this.factor.map((row) => [...row]),
    };
  }
}
