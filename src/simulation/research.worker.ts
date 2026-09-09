import {
  researchVariants,
  runTrial,
  type ResearchRequest,
  type TrialResult,
} from './research';
self.onmessage = (event: MessageEvent<ResearchRequest>) => {
  const request = event.data;
  try {
    if (
      ![10, 50, 100].includes(request.trials) ||
      ![250, 500, 1000].includes(request.rounds)
    )
      throw new Error('Invalid research budget.');
    const variants = researchVariants(request.config, request.comparison);
    const results: TrialResult[] = [];
    for (let trial = 0; trial < request.trials; trial++)
      for (const variant of variants) {
        results.push(runTrial(request, variant, trial));
        self.postMessage({
          type: 'progress',
          results,
          completed: results.length,
          total: request.trials * variants.length,
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
