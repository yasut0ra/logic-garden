import { MAX_DEPTH, MAX_GATES } from '../circuit/circuit';
export const REWARD_MODES = [
  'accuracy-delta',
  'absolute-quality',
  'complexity',
  'ternary',
] as const;
export type RewardMode = (typeof REWARD_MODES)[number];
export const REWARD_LABELS: Record<RewardMode, string> = {
  'accuracy-delta': 'Accuracy delta',
  'absolute-quality': 'Absolute quality',
  complexity: 'Improvement + complexity',
  ternary: 'Improved / same / worse',
};
export interface Quality {
  accuracy: number;
  gates: number;
  depth: number;
}
export interface RewardSettings {
  rewardMode: RewardMode;
  penalty: number;
  depthWeight: number;
}
export const complexity = (quality: Quality, depthWeight: number) =>
  quality.gates + depthWeight * quality.depth;
export function candidateReward(
  before: Quality,
  after: Quality,
  settings: RewardSettings,
): number {
  const delta = after.accuracy - before.accuracy;
  switch (settings.rewardMode) {
    case 'accuracy-delta':
      return delta;
    case 'absolute-quality':
      return after.accuracy;
    case 'complexity':
      return (
        delta -
        settings.penalty *
          (complexity(after, settings.depthWeight) -
            complexity(before, settings.depthWeight))
      );
    case 'ternary':
      return Math.sign(delta);
  }
}
export function rewardBounds(settings: RewardSettings): {
  min: number;
  max: number;
} {
  if (settings.rewardMode === 'absolute-quality') return { min: 0, max: 1 };
  const bound =
    settings.rewardMode === 'complexity'
      ? 1 + settings.penalty * (MAX_GATES + settings.depthWeight * MAX_DEPTH)
      : 1;
  return { min: -bound, max: bound };
}
export function normalizedReward(
  reward: number,
  bounds: { min: number; max: number },
): number {
  return Math.max(
    0,
    Math.min(1, (reward - bounds.min) / (bounds.max - bounds.min)),
  );
}
