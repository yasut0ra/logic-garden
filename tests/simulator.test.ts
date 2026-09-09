import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALGORITHMS } from '../src/algorithms/bandit';
import {
  circuitDepth,
  gateCount,
  validateCircuit,
} from '../src/circuit/circuit';
import { targetObservations } from '../src/circuit/booleanFunctions';
import { evaluateCircuit } from '../src/circuit/evaluator';
import { DEFAULT_CONFIG, Simulator } from '../src/simulation/simulator';
import {
  runTrial,
  summarizeTrials,
  type TrialResult,
} from '../src/simulation/research';
const observations = targetObservations('xor-and', 42, '');
void test('all algorithms reproduce full trajectories after reset, independent of batch speed', () => {
  for (const algorithm of ALGORITHMS) {
    const config = { ...DEFAULT_CONFIG, algorithm };
    const first = new Simulator(config, observations),
      reset = new Simulator(config, observations);
    first.advance(80);
    for (let i = 0; i < 80; i++) reset.step();
    assert.deepEqual(first.snapshot(), reset.snapshot());
  }
});
void test('each proposal updates rewards and counts; only accepted changes replace the circuit', () => {
  const simulator = new Simulator(DEFAULT_CONFIG, observations);
  let cumulative = 0,
    regret = 0,
    rejects = 0;
  for (let i = 0; i < 140; i++) {
    const before = simulator.snapshot(),
      after = simulator.step();
    cumulative += after.reward;
    regret += after.bestAccuracy - after.evaluation.accuracy;
    assert.equal(after.iteration, i + 1);
    assert.equal(after.cumulativeReward, cumulative);
    assert.equal(after.cumulativeRegret, regret);
    assert.equal(
      after.evaluation.accuracy,
      evaluateCircuit(after.circuit, observations).accuracy,
    );
    assert.equal(after.size, gateCount(after.circuit));
    assert.equal(after.depth, circuitDepth(after.circuit));
    assert.equal(validateCircuit(after.circuit), null);
    assert.equal(after.reward, after.last!.after - after.last!.before);
    assert.equal(
      Object.values(after.stats).reduce((sum, arm) => sum + arm.count, 0),
      i + 1,
    );
    assert.ok(after.evaluation.accuracy >= before.evaluation.accuracy);
    if (!after.last!.accepted) {
      rejects++;
      assert.equal(after.circuit, before.circuit);
      assert.ok(after.reward < 0);
    }
    assert.equal(
      evaluateCircuit(after.bestCircuit, observations).accuracy,
      after.bestAccuracy,
    );
  }
  assert.ok(rejects > 0);
  assert.ok(
    simulator.snapshot().bestAccuracy >
      new Simulator(DEFAULT_CONFIG, observations).snapshot().bestAccuracy,
  );
});
void test('complexity penalty uses the change in reachable gate count', () => {
  const simulator = new Simulator(
    { ...DEFAULT_CONFIG, penalty: 0.01 },
    observations,
  );
  for (let i = 0; i < 120; i++) {
    const before = simulator.snapshot(),
      after = simulator.step();
    if (after.last!.accepted) {
      const expected =
        after.evaluation.accuracy -
        before.evaluation.accuracy -
        0.01 * (after.size - before.size);
      assert.ok(Math.abs(after.reward - expected) < 1e-10);
    }
    assert.ok(after.reward >= -1.06 && after.reward <= 1.06);
  }
});
void test('history and logs are bounded while aggregate statistics remain exact', () => {
  const simulator = new Simulator(DEFAULT_CONFIG, observations);
  const result = simulator.advance(280);
  assert.equal(result.iteration, 280);
  assert.equal(result.history.length, 240);
  assert.equal(result.logs.length, 80);
  assert.equal(result.history.at(-1)!.iteration, 280);
  assert.equal(result.logs[0]!.iteration, 280);
  assert.ok(
    Math.abs(
      Object.values(result.stats).reduce(
        (sum, arm) => sum + arm.totalReward,
        0,
      ) - result.cumulativeReward,
    ) < 1e-9,
  );
});
void test('research pairing uses base+trial seeds and a fixed target', () => {
  const request = {
    config: DEFAULT_CONFIG,
    observations: targetObservations('random', 42, ''),
    trials: 5,
    rounds: 20,
  };
  const before = structuredClone(request);
  for (const algorithm of ALGORITHMS) {
    const actual = runTrial(request, algorithm, 2);
    assert.equal(actual.seed, 44);
    assert.deepEqual(actual, runTrial(request, algorithm, 2));
    assert.equal(
      actual.finalAccuracy,
      new Simulator(
        { ...DEFAULT_CONFIG, seed: 44, algorithm },
        request.observations,
      ).advance(20).evaluation.accuracy,
    );
  }
  assert.deepEqual(request, before);
});
void test('research aggregation reports solved-only median and sample standard deviation', () => {
  const base: TrialResult = {
    algorithm: 'ucb1',
    seed: 1,
    finalAccuracy: 1,
    bestAccuracy: 1,
    solvedAt: 10,
    cumulativeReward: 0,
    cumulativeRegret: 0,
    size: 2,
  };
  const summary = summarizeTrials([
    base,
    { ...base, seed: 2, finalAccuracy: 0.5, solvedAt: null },
    { ...base, seed: 3, solvedAt: 20 },
  ]).find((s) => s.algorithm === 'ucb1')!;
  assert.equal(summary.solved, 2);
  assert.equal(summary.medianSolvedAt, 15);
  assert.equal(summary.trials, 3);
  assert.ok(Math.abs(summary.finalAccuracy - 5 / 6) < 1e-12);
  assert.ok(Math.abs(summary.standardDeviation - Math.sqrt(1 / 12)) < 1e-12);
  assert.equal(summarizeTrials([])[0]!.medianSolvedAt, null);
});
void test('invalid seeds, algorithms and budgets fail explicitly', () => {
  for (const seed of [NaN, -1, 1.2, 2 ** 32])
    assert.throws(
      () => new Simulator({ ...DEFAULT_CONFIG, seed }, observations),
    );
  const simulator = new Simulator(DEFAULT_CONFIG, observations);
  for (const count of [0, -1, 1.5, 10001])
    assert.throws(() => simulator.advance(count));
});
