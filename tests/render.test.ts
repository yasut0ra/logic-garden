import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { CircuitCanvas } from '../src/components/CircuitCanvas';
import { ContextInspector } from '../src/components/ContextInspector';
import { ActionScorePanel } from '../src/components/ActionScorePanel';
import { HistoryChart } from '../src/components/HistoryChart';
import { Simulator, DEFAULT_CONFIG } from '../src/simulation/simulator';
import { targetObservations } from '../src/circuit/booleanFunctions';
import { ALGORITHMS } from '../src/algorithms/bandit';
void test('Circuit SVG titles contain actual node text and render without React warnings', (t) => {
  const warnings: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => warnings.push(args));
  const simulator = new Simulator(
    DEFAULT_CONFIG,
    targetObservations('xor-and', 42, ''),
  );
  const markup = renderToString(
    createElement(CircuitCanvas, {
      snapshot: simulator.snapshot(),
      inputIndex: 0,
      running: false,
    }),
  );
  assert.ok(markup.includes('<title>A: INPUT, signal 0</title>'));
  assert.ok(markup.includes('<title>g1: NAND, signal 1</title>'));
  assert.deepEqual(warnings, []);
});
void test('Context, action and history views render initial and learned snapshots for every policy', (t) => {
  const warnings: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => warnings.push(args));
  for (const algorithm of ALGORITHMS) {
    const simulator = new Simulator(
      { ...DEFAULT_CONFIG, algorithm, oracle: false },
      targetObservations('parity', 42, ''),
    );
    for (const snapshot of [simulator.snapshot(), simulator.advance(15)]) {
      const markup = renderToString(
        createElement(
          'div',
          null,
          createElement(ContextInspector, { snapshot }),
          createElement(ActionScorePanel, { snapshot, algorithm }),
          createElement(HistoryChart, { history: snapshot.history }),
        ),
      );
      assert.ok(markup.includes('not measured'));
      assert.ok(!markup.includes('NaN'));
      if (snapshot.iteration)
        assert.ok(markup.includes('observation (x, a, r) recorded'));
    }
  }
  assert.deepEqual(warnings, []);
});
