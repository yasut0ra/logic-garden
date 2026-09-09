import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Random } from '../src/random';
import { ARMS } from '../src/circuit/mutations';
import {
  ALGORITHMS,
  freshStats,
  normalizeReward,
  selectArm,
  updateStats,
} from '../src/algorithms/bandit';
import { epsilonGreedy } from '../src/algorithms/bandit/epsilonGreedy';
import { ucb1 } from '../src/algorithms/bandit/ucb1';
import { thompsonSampling } from '../src/algorithms/bandit/thompsonSampling';
void test('reward normalization preserves signed outcomes and bounded endpoints', () => {
  for (const penalty of [0, 0.01]) {
    const bound = 1 + 6 * penalty;
    assert.equal(normalizeReward(-bound, penalty), 0);
    assert.equal(normalizeReward(bound, penalty), 1);
    assert.equal(normalizeReward(0, penalty), 0.5);
    assert.ok(normalizeReward(-0.125, penalty) < 0.5);
  }
});
void test('each strategy warms up available arms and never selects an unavailable arm', () => {
  for (const algorithm of ALGORITHMS) {
    let stats = freshStats();
    const rng = new Random(13),
      posterior = new Random(15);
    const available = [ARMS[0], ARMS[3]];
    for (let i = 0; i < 60; i++) {
      const decision = selectArm(algorithm, stats, available, rng, 0.15);
      assert.ok(available.includes(decision.arm as (typeof available)[number]));
      if (i < 2) {
        assert.equal(stats[decision.arm].count, 0);
        assert.ok(decision.exploratory);
      }
      stats = updateStats(stats, decision.arm, 0, 0.5, posterior);
    }
    assert.equal(stats.add_gate.count, 0);
  }
});
void test('epsilon=0 exploits best empirical mean; epsilon=1 explores', () => {
  const stats = freshStats();
  for (const arm of ARMS)
    stats[arm] = {
      count: 10,
      normalizedTotal: 1,
      totalReward: -8,
      alpha: 2,
      beta: 10,
    };
  stats.rewire.normalizedTotal = 9;
  const exploit = epsilonGreedy(stats, [...ARMS], new Random(42), 0);
  assert.equal(exploit.arm, 'rewire');
  assert.equal(exploit.exploratory, false);
  assert.equal(
    epsilonGreedy(stats, [...ARMS], new Random(42), 1).exploratory,
    true,
  );
});
void test('UCB scores combine normalized means with the correct uncertainty bonus', () => {
  const stats = freshStats();
  stats.change_gate = {
    count: 90,
    normalizedTotal: 72,
    totalReward: 54,
    alpha: 1,
    beta: 1,
  };
  stats.rewire = {
    count: 10,
    normalizedTotal: 5,
    totalReward: 0,
    alpha: 1,
    beta: 1,
  };
  const result = ucb1(stats, ['change_gate', 'rewire'], new Random(42));
  assert.equal(result.arm, 'rewire');
  assert.ok(result.exploratory);
  assert.ok(
    Math.abs(
      result.scores.rewire!.bonus - Math.sqrt((2 * Math.log(100)) / 10),
    ) < 1e-12,
  );
  assert.equal(result.scores.rewire!.score, result.scores.rewire!.bonus + 0.5);
});
void test('Beta sampling is seeded and tracks its analytical mean', () => {
  const a = new Random(41),
    b = new Random(41);
  assert.deepEqual(
    Array.from({ length: 40 }, () => a.beta(2, 7)),
    Array.from({ length: 40 }, () => b.beta(2, 7)),
  );
  const rng = new Random(92),
    draws = Array.from({ length: 10000 }, () => rng.beta(2, 7));
  assert.ok(draws.every((n) => n >= 0 && n <= 1));
  assert.ok(
    Math.abs(draws.reduce((s, n) => s + n, 0) / draws.length - 2 / 9) < 0.01,
  );
  const stats = freshStats();
  for (const arm of ARMS) stats[arm].count = 1;
  const decision = thompsonSampling(stats, [...ARMS], new Random(17));
  assert.equal(
    decision.scores[decision.arm]!.score,
    Math.max(...Object.values(decision.scores).map((s) => s.score)),
  );
});
void test('posterior updates are integer Bernoulli observations; rejected rewards count', () => {
  let stats = freshStats();
  const rng = new Random(3);
  stats = updateStats(stats, 'rewire', -1, 0, rng);
  assert.equal(stats.rewire.beta, 2);
  assert.equal(stats.rewire.alpha, 1);
  assert.equal(stats.rewire.totalReward, -1);
  assert.equal(stats.rewire.count, 1);
  stats = updateStats(stats, 'rewire', 1, 1, rng);
  assert.equal(stats.rewire.alpha, 2);
  assert.equal(stats.rewire.beta, 2);
  for (let i = 0; i < 3000; i++)
    stats = updateStats(stats, 'rewire', -0.5, 0.25, rng);
  assert.ok(Math.abs((stats.rewire.alpha - 2) / 3000 - 0.25) < 0.025);
});
