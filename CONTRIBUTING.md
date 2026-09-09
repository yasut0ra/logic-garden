# Contributing

Logic Garden is a small, reproducible experiment in mutation-category bandits.
Bug reports, algorithm improvements and focused visual refinements are welcome.

## Development

Use Node 22 and the included npm lockfile:

```bash
npm ci
npm run dev
```

Before opening a pull request, run the same checks as CI:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:worker
```

Format files you changed with `npx --no-install oxfmt --write <files>`.
Keep changes to the vendored `components/ui/` catalog focused on an actual need.

## Reporting a problem

Include the target truth table, policy, seed, context profile, reward mode,
alpha, ridge, epsilon, complexity penalty, depth weight, round budget and steps to reproduce. For UI issues, include
the browser and viewport size. Research exports contain the configuration and
observations needed to reproduce an experiment.

## Changes to the search engine

- Keep bandit selection separate from circuit evaluation and UI scheduling.
- Generate candidates without looking at the target or candidate accuracy.
- Preserve gate arity, acyclicity, size and depth constraints.
- Use explicit seeded randomness, never wall-clock time or `Math.random()`.
- Train on the exact pre-selection context and actual selected reward, including rejected proposals.
- Keep oracle alternatives out of models, features, best accuracy and acceptance.
- Preserve fixed feature order and stable numerical updates.
- Explain changes to reward, acceptance or regret in the README.
- If an intentional algorithm change alters the reference experiment, regenerate
  `docs/benchmark-seed-42.json` and explain the difference in the pull request.

The test suite checks the contracts behind these rules. Add a regression test
when fixing an engine defect; document visual checks for UI changes.
