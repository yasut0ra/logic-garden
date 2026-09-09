import { ALGORITHMS } from '../algorithms/bandit';
import { runTrial, type ResearchRequest, type TrialResult } from './research';
self.onmessage = (event: MessageEvent<ResearchRequest>) => {
  const request = event.data;
  try {
    if (
      ![5, 10, 20].includes(request.trials) ||
      ![250, 500, 1000].includes(request.rounds)
    )
      throw new Error('Invalid research budget.');
    const results: TrialResult[] = [];
    for (let trial = 0; trial < request.trials; trial++)
      for (const algorithm of ALGORITHMS) {
        results.push(runTrial(request, algorithm, trial));
        self.postMessage({
          type: 'progress',
          results,
          completed: results.length,
          total: request.trials * ALGORITHMS.length,
        });
      }
    self.postMessage({ type: 'complete', results });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Experiment failed.',
    });
  }
};
