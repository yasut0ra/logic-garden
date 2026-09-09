/** Integration check of the exact browser Worker bundle emitted by the build.
 * worker_threads supplies a small Web Worker message adapter, without a browser.
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { DEFAULT_CONFIG } from '../src/simulation/simulator';
import { targetObservations } from '../src/circuit/booleanFunctions';
import { runTrial, type TrialResult } from '../src/simulation/research';
import { researchVariants } from '../src/simulation/research';

const directory = resolve('dist/client/_next/static/workers');
const file = (await readdir(directory)).find((name) =>
  /^research\.worker-.*\.js$/.test(name),
);
assert.ok(file, 'Run npm run build first.');
const workerUrl = pathToFileURL(resolve(directory, file)).href;
const worker = new Worker(
  `
  const { parentPort } = require('node:worker_threads');
  globalThis.self = { postMessage: data => parentPort.postMessage(data) };
  import(${JSON.stringify(workerUrl)}).then(() => {
    parentPort.on('message', data => self.onmessage({ data }));
    parentPort.postMessage({ type: 'ready' });
  }).catch(error => { throw error; });
`,
  { eval: true },
);
const request = {
  config: DEFAULT_CONFIG,
  observations: targetObservations('xor-and', 42, ''),
  comparison: 'algorithms' as const,
  trials: 10,
  rounds: 250,
};
try {
  await new Promise<void>((resolvePromise, reject) => {
    let progress = 0,
      rejectedInvalid = false;
    const timeout = setTimeout(
      () => reject(new Error('Worker timed out.')),
      60000,
    );
    worker.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    worker.on(
      'message',
      (message: {
        type: string;
        results: TrialResult[];
        completed: number;
        total: number;
        message: string;
      }) => {
        try {
          if (message.type === 'ready')
            worker.postMessage({ ...request, trials: -1 });
          else if (message.type === 'error') {
            assert.equal(message.message, 'Invalid research budget.');
            assert.equal(rejectedInvalid, false);
            rejectedInvalid = true;
            worker.postMessage(request);
          } else if (message.type === 'progress') {
            progress++;
            assert.equal(message.completed, progress);
            assert.equal(message.results.length, progress);
            assert.equal(message.total, 40);
          } else if (message.type === 'complete') {
            assert.equal(progress, 40);
            assert.ok(rejectedInvalid);
            const expected: TrialResult[] = [];
            for (let trial = 0; trial < request.trials; trial++)
              for (const variant of researchVariants(
                request.config,
                request.comparison,
              ))
                expected.push(runTrial(request, variant, trial));
            assert.deepEqual(message.results, expected);
            clearTimeout(timeout);
            resolvePromise();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      },
    );
  });
  console.log(
    'Built Worker verified: invalid budget rejected, 40 progress updates, all results match the engine.',
  );
} finally {
  await worker.terminate();
}
