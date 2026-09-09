/** Mulberry32: all simulation randomness is explicit and reproducible. */
export class Random {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  pick<T>(values: readonly T[]): T {
    if (!values.length) throw new Error('Cannot sample an empty set.');
    return values[Math.floor(this.next() * values.length)]!;
  }
  normal(): number {
    return (
      Math.sqrt(-2 * Math.log(Math.max(this.next(), Number.EPSILON))) *
      Math.cos(2 * Math.PI * this.next())
    );
  }
  /** Marsaglia–Tsang gamma sampler; shape >= 1 for our Beta priors. */
  gamma(shape: number): number {
    if (shape < 1)
      return (
        this.gamma(shape + 1) *
        Math.pow(Math.max(this.next(), Number.EPSILON), 1 / shape)
      );
    const d = shape - 1 / 3,
      c = 1 / Math.sqrt(9 * d);
    for (;;) {
      const x = this.normal(),
        base = 1 + c * x;
      if (base <= 0) continue;
      const v = base ** 3,
        u = Math.max(this.next(), Number.EPSILON);
      if (
        u < 1 - 0.0331 * x ** 4 ||
        Math.log(u) < (x * x) / 2 + d * (1 - v + Math.log(v))
      )
        return d * v;
    }
  }
  beta(alpha: number, beta: number): number {
    const a = this.gamma(alpha),
      b = this.gamma(beta);
    return a / (a + b);
  }
}
