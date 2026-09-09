import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LinearModel, dot } from '../src/algorithms/bandit/linearAlgebra';
import { createPolicy } from '../src/algorithms/bandit/BanditPolicy';
import { Random } from '../src/random';
import { DEFAULT_CONFIG, Simulator } from '../src/simulation/simulator';
import { targetObservations } from '../src/circuit/booleanFunctions';
import { CONTEXT_MODES } from '../src/circuit/features';
const close = (actual: number, expected: number, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);
void test('Cholesky ridge update matches an analytic inverse and reconstructs A', () => {
  const model = new LinearModel(2, 1);
  model.update([1, 2], 0.5); // A = [[2,2],[2,5]], inverse = [[5,-2],[-2,2]] / 6
  close(model.coefficients()[0]!, 1 / 12);
  close(model.coefficients()[1]!, 1 / 6);
  close(model.predict([1, 2]).mean, 5 / 12);
  close(model.predict([1, 2]).uncertainty, Math.sqrt(5 / 6));
  const rng = new Random(42);
  for (let i = 0; i < 500; i++)
    model.update([1, rng.next() * 2 - 1], rng.next() * 2 - 1);
  const { A, L, b } = model.parameters(),
    theta = model.coefficients();
  for (let i = 0; i < 2; i++) {
    close(dot(A[i]!, theta), b[i]!, 1e-8);
    for (let j = 0; j < 2; j++) close(dot(L[i]!, L[j]!), A[i]![j]!, 1e-8);
  }
});
void test('Repeated collinear observations remain finite and reduce uncertainty', () => {
  const model = new LinearModel(35, 0.01),
    x = Array(35).fill(1) as number[];
  const initial = model.predict(x).uncertainty;
  for (let i = 0; i < 2000; i++) model.update(x, -0.125);
  const after = model.predict(x);
  assert.ok(after.uncertainty < initial / 100);
  close(after.mean, -0.125, 1e-6);
  assert.throws(() => model.update([NaN], 1));
  assert.throws(() => new LinearModel(0, 1));
});
void test('Gaussian weight sampling has the covariance alpha² A^-1', () => {
  const model = new LinearModel(2, 1);
  model.update([1, 2], 0.5);
  const rng = new Random(71),
    mean = model.coefficients(),
    samples = 12000,
    sums = [0, 0, 0];
  for (let i = 0; i < samples; i++) {
    const v = model.sampleWeights(rng, 0.5).map((n, j) => n - mean[j]!);
    sums[0]! += v[0]! ** 2;
    sums[1]! += v[0]! * v[1]!;
    sums[2]! += v[1]! ** 2;
  }
  close(sums[0]! / samples, (0.25 * 5) / 6, 0.008);
  close(sums[1]! / samples, (-0.25 * 2) / 6, 0.008);
  close(sums[2]! / samples, (0.25 * 2) / 6, 0.008);
});
void test('Contextual policies learn opposite actions for opposite contexts; UCB1 ignores context', () => {
  for (const algorithm of [
    'linucb',
    'linear-thompson',
    'contextual-epsilon',
    'ucb1',
  ] as const) {
    const policy = createPolicy(
      {
        ...DEFAULT_CONFIG,
        algorithm,
        alpha: 0,
        epsilon: 0,
        rewardMin: -1,
        rewardMax: 1,
      },
      2,
    );
    for (let i = 0; i < 30; i++) {
      policy.update([1, 1], 'change_gate', 1);
      policy.update([1, -1], 'change_gate', -1);
      policy.update([1, 1], 'rewire', -1);
      policy.update([1, -1], 'rewire', 0.8);
    }
    const a = policy.selectAction([1, 1], ['change_gate', 'rewire']),
      b = policy.selectAction([1, -1], ['change_gate', 'rewire']);
    assert.equal(a.arm, 'change_gate');
    assert.equal(b.arm, algorithm === 'ucb1' ? 'change_gate' : 'rewire');
  }
});
void test('Feature profiles have stable dimensions, fixed normalization and current error bits', () => {
  const observations = targetObservations('parity', 42, '');
  for (const [index, contextMode] of CONTEXT_MODES.entries()) {
    const simulator = new Simulator(
      { ...DEFAULT_CONFIG, contextMode, maxIterations: 100 },
      observations,
    );
    const initial = simulator.snapshot();
    assert.equal(initial.context.vector.length, [12, 18, 35][index]);
    assert.equal(initial.context.features[0]!.key, 'bias');
    const next = simulator.advance(30);
    assert.deepEqual(
      next.context.features.map((f) => f.key),
      initial.context.features.map((f) => f.key),
    );
    assert.ok(
      next.context.vector.every((v) => Number.isFinite(v) && v >= -1 && v <= 1),
    );
    for (const f of next.context.features.filter((f) => f.group === 'error')) {
      const row = parseInt(f.key.slice(6), 2);
      assert.equal(
        f.value,
        Number(next.evaluation.predicted[row] !== observations[row]!.expected),
      );
    }
    if (contextMode === 'full')
      close(
        next.context.features.find((f) => f.key === 'progress')!.value,
        0.3,
      );
  }
});
