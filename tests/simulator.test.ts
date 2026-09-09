import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALGORITHMS } from '../src/algorithms/bandit';
import {
  circuitDepth,
  gateCount,
  validateCircuit,
} from '../src/circuit/circuit';
import { ARMS } from '../src/circuit/mutations';
import { targetObservations } from '../src/circuit/booleanFunctions';
import { evaluateCircuit } from '../src/circuit/evaluator';
import { DEFAULT_CONFIG, Simulator } from '../src/simulation/simulator';
import { acceptCandidate } from '../src/simulation/acceptance';
import {
  candidateReward,
  REWARD_MODES,
  rewardBounds,
} from '../src/simulation/reward';
import {
  COMPARISONS,
  researchVariants,
  researchExport,
  runTrial,
  summarizeTrials,
  type TrialResult,
} from '../src/simulation/research';
import { LinearModel } from '../src/algorithms/bandit/linearAlgebra';
const observations = targetObservations('xor-and', 42, '');
void test('Every policy reproduces trajectories across reset and batching', () => {
  for (const algorithm of ALGORITHMS) {
    const config = { ...DEFAULT_CONFIG, algorithm },
      a = new Simulator(config, observations),
      b = new Simulator(config, observations);
    a.advance(80);
    for (let i = 0; i < 80; i++) b.step();
    assert.deepEqual(a.snapshot(), b.snapshot());
  }
});
void test('Selected pre-action context trains only the selected model, including rejected candidates', () => {
  const simulator = new Simulator(DEFAULT_CONFIG, observations);
  const models = Object.fromEntries(
    ARMS.map((a) => [a, new LinearModel(35, 1)]),
  );
  let cumulative = 0,
    regret = 0,
    rejects = 0;
  for (let i = 0; i < 140; i++) {
    const before = simulator.snapshot(),
      after = simulator.step(),
      arm = after.decision!.arm;
    cumulative += after.reward;
    regret += after.oracle!.instantRegret;
    assert.equal(after.cumulativeReward, cumulative);
    assert.equal(after.cumulativeRegret, regret);
    assert.deepEqual(after.decisionContext, before.context);
    assert.deepEqual(after.last!.context, before.context.vector);
    models[arm]!.update(before.context.vector, after.reward);
    assert.deepEqual(
      after.stats[arm].coefficients,
      models[arm]!.coefficients(),
    );
    for (const other of ARMS.filter((a) => a !== arm))
      assert.deepEqual(after.stats[other], before.stats[other]);
    assert.equal(after.oracle!.selectedReward, after.reward);
    assert.equal(
      after.oracle!.instantRegret,
      Math.max(...(Object.values(after.oracle!.rewards) as number[])) -
        after.reward,
    );
    assert.equal(
      evaluateCircuit(after.candidate!, observations).accuracy,
      after.last!.after,
    );
    assert.equal(
      evaluateCircuit(after.circuit, observations).accuracy,
      after.evaluation.accuracy,
    );
    assert.equal(after.reward, after.last!.after - after.last!.before);
    assert.equal(validateCircuit(after.circuit), null);
    assert.ok(after.evaluation.accuracy >= before.evaluation.accuracy);
    assert.equal(
      Object.values(after.stats).reduce((sum, a) => sum + a.count, 0),
      i + 1,
    );
    if (!after.last!.accepted) {
      rejects++;
      assert.equal(after.circuit, before.circuit);
    } else
      assert.ok(
        after.last!.after > after.last!.before ||
          after.size + 0.5 * after.depth < before.size + 0.5 * before.depth,
      );
    assert.equal(
      evaluateCircuit(after.bestCircuit, observations).accuracy,
      after.bestAccuracy,
    );
  }
  assert.ok(rejects > 0);
});
void test('Oracle on/off never changes selected mutations, learning, features or best accuracy', () => {
  for (const algorithm of ['linucb', 'linear-thompson', 'thompson'] as const) {
    const on = new Simulator(
        { ...DEFAULT_CONFIG, algorithm, oracle: true },
        observations,
      ),
      off = new Simulator(
        { ...DEFAULT_CONFIG, algorithm, oracle: false },
        observations,
      );
    for (let i = 0; i < 70; i++) {
      const a = on.step(),
        b = off.step();
      for (const key of [
        'circuit',
        'candidate',
        'stats',
        'decision',
        'context',
        'bestCircuit',
        'bestAccuracy',
        'cumulativeReward',
        'solvedAt',
      ] as const)
        assert.deepEqual(a[key], b[key]);
      assert.equal(b.cumulativeRegret, null);
    }
  }
});
void test('Acceptance is accuracy-first and rejects neutral moves regardless of reward design', () => {
  const before = { accuracy: 0.75, gates: 3, depth: 2 };
  assert.ok(acceptCandidate(before, { accuracy: 1, gates: 8, depth: 5 }, 0.5));
  assert.ok(acceptCandidate(before, { ...before, gates: 2 }, 0.5));
  assert.ok(!acceptCandidate(before, { ...before }, 0.5));
  const worse = { accuracy: 0.5, gates: 1, depth: 1 };
  assert.ok(
    candidateReward(before, worse, {
      ...DEFAULT_CONFIG,
      rewardMode: 'absolute-quality',
    }) > 0,
  );
  assert.ok(!acceptCandidate(before, worse, 0.5));
  for (const rewardMode of REWARD_MODES) {
    const config = { ...DEFAULT_CONFIG, rewardMode },
      s = new Simulator(config, observations),
      bounds = rewardBounds(config);
    for (let i = 0; i < 50; i++) {
      const a = s.snapshot(),
        b = s.step();
      const candidate = {
        accuracy: b.last!.after,
        gates: gateCount(b.candidate!),
        depth: circuitDepth(b.candidate!),
      };
      assert.equal(
        b.reward,
        candidateReward(
          { accuracy: a.evaluation.accuracy, gates: a.size, depth: a.depth },
          candidate,
          config,
        ),
      );
      assert.ok(b.reward >= bounds.min && b.reward <= bounds.max);
    }
  }
  assert.equal(
    candidateReward(
      before,
      { ...before, gates: 4, depth: 3 },
      { ...DEFAULT_CONFIG, rewardMode: 'complexity' },
    ),
    -0.015,
  );
  assert.equal(
    candidateReward(
      before,
      { ...before, accuracy: 1 },
      { ...DEFAULT_CONFIG, rewardMode: 'ternary' },
    ),
    1,
  );
});
void test('History stays bounded; budget is exact and completed steps are no-ops', () => {
  const simulator = new Simulator(
      { ...DEFAULT_CONFIG, maxIterations: 280 },
      observations,
    ),
    s = simulator.advance(500);
  assert.equal(s.iteration, 280);
  assert.equal(s.history.length, 240);
  assert.equal(s.logs.length, 80);
  assert.equal(s.complete, true);
  assert.equal(simulator.step(), s);
  assert.ok(
    Math.abs(
      Object.values(s.stats).reduce((sum, a) => sum + a.totalReward, 0) -
        s.cumulativeReward,
    ) < 1e-9,
  );
});
void test('Research variants pair seeds, fix target, force oracle and use requested budget', () => {
  for (const comparison of COMPARISONS) {
    const request = {
      config: { ...DEFAULT_CONFIG, oracle: false },
      observations: targetObservations('random', 42, ''),
      trials: 10,
      rounds: 20,
      comparison,
    };
    const saved = structuredClone(request),
      variants = researchVariants(request.config, comparison);
    assert.equal(variants.length, comparison === 'contexts' ? 3 : 4);
    for (const variant of variants) {
      const actual = runTrial(request, variant, 2);
      assert.equal(actual.seed, 44);
      assert.deepEqual(actual, runTrial(request, variant, 2));
      const direct = new Simulator(
        { ...variant.config, seed: 44, oracle: true, maxIterations: 20 },
        request.observations,
      ).advance(20);
      assert.equal(actual.finalAccuracy, direct.evaluation.accuracy);
      assert.equal(actual.cumulativeRegret, direct.cumulativeRegret);
      assert.equal(
        Object.values(actual.actions).reduce((a, b) => a + b, 0),
        20,
      );
    }
    assert.deepEqual(request, saved);
  }
});
void test('Research reports solved-only median, censoring and sample standard deviation', () => {
  const base: TrialResult = {
    variant: 'ucb1',
    label: 'UCB1',
    algorithm: 'ucb1',
    seed: 1,
    finalAccuracy: 1,
    bestAccuracy: 1,
    solvedAt: 10,
    cumulativeReward: 0,
    cumulativeRegret: 0,
    size: 2,
    depth: 1,
    accepted: 3,
    actions: Object.fromEntries(
      ARMS.map((a) => [a, 1]),
    ) as TrialResult['actions'],
  };
  const s = summarizeTrials([
    base,
    { ...base, seed: 2, finalAccuracy: 0.5, solvedAt: null },
    { ...base, seed: 3, solvedAt: 20 },
  ])[0]!;
  assert.equal(s.solved, 2);
  assert.equal(s.censored, 1);
  assert.equal(s.medianSolvedAt, 15);
  assert.equal(s.trials, 3);
  assert.ok(Math.abs(s.finalAccuracy - 5 / 6) < 1e-12);
  assert.ok(Math.abs(s.standardDeviation - Math.sqrt(1 / 12)) < 1e-12);
  assert.deepEqual(summarizeTrials([]), []);
});
void test('Invalid model settings, observations and budgets fail explicitly', () => {
  for (const seed of [NaN, -1, 1.2, 2 ** 32])
    assert.throws(
      () => new Simulator({ ...DEFAULT_CONFIG, seed }, observations),
    );
  for (const alpha of [NaN, -1, 6])
    assert.throws(
      () => new Simulator({ ...DEFAULT_CONFIG, alpha }, observations),
    );
  for (const ridge of [0, Infinity, -1])
    assert.throws(
      () => new Simulator({ ...DEFAULT_CONFIG, ridge }, observations),
    );
  assert.throws(() => new Simulator(DEFAULT_CONFIG, observations.slice(1)));
  const simulator = new Simulator(DEFAULT_CONFIG, observations);
  for (const count of [0, -1, 1.5, 10001])
    assert.throws(() => simulator.advance(count));
});

void test('Research export records variant configurations and the effective budget', () => {
  const request = {
    config: { ...DEFAULT_CONFIG, oracle: false },
    observations,
    comparison: 'contexts' as const,
    rounds: 250,
    trials: 10,
  };
  const exported = researchExport(request, 'target', []);
  assert.equal(exported.config.maxIterations, 250);
  assert.equal(exported.config.oracle, true);
  assert.equal(exported.variants.length, 3);
  for (const variant of exported.variants) {
    assert.equal(variant.config.maxIterations, 250);
    assert.equal(variant.config.oracle, true);
    assert.equal(variant.config.algorithm, 'linucb');
  }
  assert.equal(exported.trials, 10);
});
