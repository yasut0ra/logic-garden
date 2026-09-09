import { ALGORITHMS } from '../src/algorithms/bandit';
import { targetObservations } from '../src/circuit/booleanFunctions';
import {
  runTrial,
  summarizeTrials,
  type TrialResult,
} from '../src/simulation/research';
import { DEFAULT_CONFIG } from '../src/simulation/simulator';

const request = {
  config: DEFAULT_CONFIG,
  observations: targetObservations('xor-and', DEFAULT_CONFIG.seed, ''),
  trials: 5,
  rounds: 500,
};
const results: TrialResult[] = [];
for (let trial = 0; trial < request.trials; trial++) {
  for (const algorithm of ALGORITHMS)
    results.push(runTrial(request, algorithm, trial));
}
console.log(
  JSON.stringify(
    {
      format: 'logic-garden-research-v1',
      target: '(A XOR B) AND C',
      ...request,
      results,
      summaries: summarizeTrials(results),
    },
    null,
    2,
  ),
);
