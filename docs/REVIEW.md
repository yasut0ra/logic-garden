# Implementation review · contextual search

## Algorithm boundaries

- `BanditPolicy` observes only the pre-selection context and available action mask. Target expressions and oracle alternatives stay outside it.
- Selected candidates update the selected model even when rejected. Tests independently replay selected ridge updates from stored contexts and rewards.
- LinUCB separates mean, uncertainty and bonus. Linear Thompson samples the documented covariance via a transposed triangular solve.
- Rank-one Cholesky updates avoid explicit inversion; tests compare an analytic 2×2 inverse, reconstruct the Gram matrix, exercise repeated 35D collinear inputs, and verify empirical Gaussian covariance.
- Context profiles are ordered, normalized and fixed-dimensional (12/18/35). Recent statistics use only the last 32 selected observations; no counterfactual reward reaches features or best accuracy.
- Acceptance prioritizes accuracy and then smaller gates + β × depth. Neutral plateaus are rejected; local optima are visible in the committed benchmark.
- All reward modes train on actual candidate reward. Absolute-quality reward and acceptance can disagree intentionally.
- Oracle evaluation includes the exact selected candidate and one sampled candidate per other available category. ON/OFF trajectory equality is tested. Regret is a sampled opportunity gap, not exhaustive or theoretical oracle regret.

## Reproducibility and experiments

- Gate arities, topological order, eight-gate and five-depth limits are validated across reachable mutations. The target is a fixed eight-row observation table.
- All seven policies reproduce full snapshots across reset and batching. Exact round budgets stop further learning.
- Research uses the live engine, paired seeds, fixed observations, forced oracle evaluation and explicit algorithm/reward/context variants.
- Results include final/best accuracy, solved-only median, censoring, sample SD, reward/regret, size/depth, accepted count and action distributions.
- Reward modes have different units; the UI and README advise comparing accuracy, success and complexity across them. Regret follows each policy's own evolving trajectory.

## UI and runtime

- Current circuit, proposed candidate, decision context and current context are distinct snapshots. Predictions are pre-update; displayed coefficients and pull counts are post-update.
- Rejected candidates briefly appear and then revert. Accepted structures remain; rewired connections have functional transitions. Reduced-motion CSS suppresses animation.
- Setting changes reset simulation and terminate stale research workers. Invalid seed/expression input preserves the active experiment. Budget completion disables START/STEP.
- The truth-table probe does not change the evaluation population. Logs are keyboard-scrollable, controls use labeled accessible primitives, and detailed vectors are expandable.
- Candidate sets are cached across rejections; history is bounded to 240 samples and 80 logs. Workers support cancellation; backgrounding pauses live execution.
- Existing runtime, lockfile and vendored UI components are retained. No dependency was added for the new models.

## Verification scope

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, then `npm run test:worker`.

The exact emitted Worker bundle is loaded through a Node `worker_threads` Web Worker adapter. It rejects invalid budgets, reports 40 completed-trial progress messages for the four-policy comparison, and matches source-engine results. The reference benchmark is generated directly from the engine.

HTTP checks verify local route delivery. Browser clicking, responsive screenshots, actual-browser Worker lifecycle and optional WebMCP registration are not covered by these checks. No fabricated screenshot or demo result is included.
