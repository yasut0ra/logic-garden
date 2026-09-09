# Implementation review

## Algorithms and reward

- The bandit chooses a mutation category before the concrete candidate is sampled. Candidates cannot query target accuracy.
- Invalid and unavailable mutations do not receive fabricated rewards. Categories with no legal candidates are masked.
- All evaluated proposals update statistics; acceptance is a separate decision.
- The fixed affine normalization handles negative raw rewards for all three algorithms consistently.
- Thompson Sampling uses seeded Beta draws and a documented Bernoulli resampling update, with separate RNG streams.
- Neutral acceptance permits plateau traversal. Greedy acceptance can still stop at a local optimum. The benchmark exposes this instead of guaranteeing success.
- Best-seen pseudo regret is explicitly defined. Because accepted accuracy is monotone for the supplied settings, zero regret is expected and is not a convergence criterion.

## Representation and reproducibility

- Topological storage and validation enforce DAG invariants, gate arity, output structure, six-gate size and three-gate depth.
- Edges are derived from node input slots; disconnected logic is pruned.
- All eight inputs are evaluated deterministically. The target AST stays behind an observation interface.
- Same configuration and seed reproduce the full trajectory, including when rounds are batched.
- Research uses paired seeds, a fixed truth table and the exact live simulation engine. Results include censored unsolved trials and sample SD.

## UI and performance

- Circuit paths and gate symbols come from the current circuit; all metrics and logs come from real engine snapshots.
- UCB score components use the same pre-update snapshot, avoiding a misleading sum of a new mean and an old bonus.
- Setting changes reset state and cancel stale research workers. Invalid expressions do not overwrite the active experiment.
- The truth-table probe pauses animation without changing the evaluation population.
- Long logs are keyboard-scrollable. Forms have labels, controls use accessible primitives, and animation respects reduced-motion settings.
- Candidate sets are cached across rejections. UI history is bounded to 240 samples and 80 log records; aggregate statistics remain cumulative.
- Research runs in a Worker with termination-based cancellation. MAX live speed uses small batches. Live execution pauses while the page is hidden.
- A dependency audit found issues in the original scaffold. Compatible patched versions were installed, preserving the lockfile and architecture.

## Verification

- 19 deterministic unit/property/integration tests cover truth tables, parser errors, DAG constraints across reachable mutation sets, bandit selection and posterior sampling, reward accounting, reproducibility, research pairing and aggregation.
- TypeScript, authored-source lint and the production build are checked.
- The built research Worker is exercised through a Node worker_threads adapter: error handling, all 15 progress events and final results are compared against the same engine.
- The exact local route is checked for a successful HTTP response. Browser clicking, responsive screenshot inspection and real-browser WebMCP registration have not been verified. The optional WebMCP adapter is not required to use the app.

The vendored UI catalog is retained without unrelated rewrites and is excluded from authored-source lint. The two SVG role suppressions preserve accessible inline graphics, and the log tabindex suppression preserves keyboard scrolling.
