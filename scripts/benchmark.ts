import { researchVariants } from '../src/simulation/research';
import { targetObservations } from '../src/circuit/booleanFunctions';
import {
  runTrial,
  researchExport,
  type TrialResult,
} from '../src/simulation/research';
import { DEFAULT_CONFIG } from '../src/simulation/simulator';

const request = {
  config: DEFAULT_CONFIG,
  observations: targetObservations('xor-and', DEFAULT_CONFIG.seed, ''),
  comparison: 'algorithms' as const,
  trials: 10,
  rounds: 500,
};
const results: TrialResult[] = [];
for (let trial = 0; trial < request.trials; trial++) {
  for (const variant of researchVariants(request.config, request.comparison))
    results.push(runTrial(request, variant, trial));
}
console.log(
  JSON.stringify(researchExport(request, '(A XOR B) AND C', results), null, 2),
);
