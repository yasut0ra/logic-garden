import { complexity, type Quality } from './reward';
/** Acceptance is deliberately independent of the reward mode and its penalty λ. */
export function acceptCandidate(
  before: Quality,
  after: Quality,
  depthWeight: number,
): boolean {
  if (after.accuracy > before.accuracy) return true;
  return (
    after.accuracy === before.accuracy &&
    complexity(after, depthWeight) < complexity(before, depthWeight) - 1e-12
  );
}
