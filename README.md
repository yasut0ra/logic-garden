# Logic Garden

**Can a contextual bandit learn how to build a logic circuit?**

Logic Garden is an interactive visualization of a contextual bandit that learns which circuit mutation to apply based on the current state of a Boolean circuit. Inspect the features, predicted rewards, uncertainty, selected mutation, actual reward, and online update in a terminal-style laboratory.

```text
Circuit State
      ↓
Context Features
      ↓
Contextual Bandit
      ↓
Mutation Action
      ↓
Candidate Circuit
      ↓
    Reward ─────→ Online Update
      ↓
Accept / Reject → Next Circuit State
```

<!-- Actual app recording: add docs/demo.gif here using the recipe in docs/MEDIA.md. -->

## Run locally

Use **Node 22.13+** (Node 22 recommended). No API key, account, or database is required.

```bash
npm ci
npm run dev
```

Open the Local URL printed in the terminal. **START**, **PAUSE**, **STEP**, and **RESET** control the simulation. Reset with the same settings reproduces the complete trajectory.

```bash
npm test             # numerical, circuit, policy and simulation checks
npm run typecheck
npm run lint
npm run build        # production bundle
npm run test:worker  # exercise the exact built research Worker
npm start            # serve the built app locally with Wrangler
npm run benchmark    # deterministic headless comparison
```

The app uses React 19, TypeScript, SVG, Tailwind CSS and accessible shadcn / Base UI primitives. Its Next.js App Router structure runs on **Vinext / Vite**. Dependencies are pinned; Vinext remains a beta runtime. GitHub source publication is separate from website deployment.

## Why contextual bandits?

Changing a gate may help an inaccurate circuit but harm an already useful one. Adding logic is constrained by the current size and depth. A non-contextual bandit averages these different situations together; a contextual policy estimates each action's reward from the current state.

**An action is a mutation category, not a gate or an entire circuit.** After the policy chooses a category, a separate generator uniformly samples one concrete legal mutation. The generator cannot inspect the target expression or candidate accuracy.

This is **adaptive local search using a contextual bandit**, not a rigorous stationary contextual-bandit benchmark. Updating the circuit changes future states, available actions and reward distributions. The feature vector is a lossy summary: identical features can conceal different graphs or histories. The demo does not establish classical regret guarantees, causal rules, or guaranteed convergence.

## Problem formulation

An unknown Boolean function maps three bits to one bit. The learner receives its eight input/output observations, not its expression or syntax tree. Every candidate is evaluated deterministically on `000` through `111`:

$$\operatorname{Acc}(C)=\frac{\text{correct outputs}}{8}.$$

At round $t$, the current circuit and available search history form the state summarized by

$$x_t=\phi(C_t),\qquad a_t\in\mathcal A(C_t).$$

Here $\phi(C_t)$ is shorthand for circuit **and observed history** features. The policy chooses an available category; its sampled mutation produces $C'_t$. The default reward is

$$r_t=\operatorname{Acc}(C'_t)-\operatorname{Acc}(C_t).$$

Accept or reject the candidate, then update **only the selected action** using the exact observation $(x_t,a_t,r_t)$. A rejected candidate still trains the policy on its actual reward. Its pre-selection context is retained; recomputing features from the resulting circuit would train on the wrong state.

Constraints: **3 inputs, at most 8 reachable gates, depth at most 5, one output**. Nodes are topologically ordered; cycles, missing inputs and invalid gate arities are rejected. Edges are derived from input slots. Disconnected gates are pruned, all three input terminals remain, and a direct input-to-output wire is valid. Depth excludes terminals.

## Context

All profiles include a regularized constant intercept. Most features lie in `[0,1]`; recent reward features use a fixed reward bound and retain their sign in `[-1,1]`.

| Group             | Features                                                                                                    | Normalization                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Performance · 6   | Current / best accuracy, recent accuracy improvement, last reward, moving mean reward, stagnation           | Accuracy fractions; reward / bound; stagnation / budget           |
| Structure · 11    | Gate count, depth, counts of AND/OR/XOR/NAND/NOR/NOT, edges, average fan-in, unused node ratio              | Counts / 8; depth / 5; edges / 17; fan-in / 2; unused / all nodes |
| Search · 9        | Budget progress, accepted / rejected fractions, recent accuracy-improvement rate for each of six categories | Fractions in `[0,1]`                                              |
| Error pattern · 8 | Whether the current circuit is wrong at each input, `000` through `111`                                     | 0 = correct, 1 = incorrect                                        |

Recent statistics use the **last 32 selected proposals**, newest first. An action's recent success means a positive accuracy change, independently of reward mode; its rate is zero if unobserved in the window. Recent improvement is current accuracy minus accuracy before the oldest selected proposal in that window. Best accuracy excludes unselected oracle candidates. Unused nodes include unused input terminals; disconnected gates have already been pruned.

The profiles are **Structural (12D)**, **Performance + Structural (18D)**, and **Full (35D)**. Feature order, raw values, definitions and normalized values are available in the engine's `Context`. The inspector switches between **AT SELECTION** (the last decision's exact input) and **CURRENT** (input for the next decision); the full vector can be expanded.

## Actions

| Action        | Mutation                                                  |
| ------------- | --------------------------------------------------------- |
| `change_gate` | Replace a binary gate with another binary gate type       |
| `add_gate`    | Insert a binary gate on an edge, with another legal input |
| `remove_gate` | Bypass a gate through one of its inputs                   |
| `rewire`      | Change one input connection without introducing a cycle   |
| `add_not`     | Insert NOT on an edge                                     |
| `remove_not`  | Bypass a NOT gate                                         |

A category with no legal candidates is masked, not assigned a fabricated zero reward. The policy/generator boundary leaves room for future hierarchical selection of concrete graph transformations.

## Policies and LinUCB

| Policy                   | Selection                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Random                   | Uniform over available categories                                                         |
| UCB1                     | Non-contextual normalized empirical mean plus count-based bonus                           |
| Contextual ε-Greedy      | Per-action linear reward prediction; random action with probability ε                     |
| LinUCB                   | Per-action linear prediction plus context-dependent uncertainty bonus                     |
| Linear Thompson Sampling | Sample one Gaussian weight vector per available action and maximize its contextual reward |
| Legacy ε-Greedy          | Non-contextual empirical mean with random exploration                                     |
| Legacy Beta Thompson     | Sample a Beta posterior over randomized normalized rewards                                |

LinUCB maintains a disjoint ridge model for each category, initialized with $A_a=\lambda_{\rm ridge}I$ and $b_a=0$. Ridge regularization is distinct from the complexity penalty $\lambda$.

$$\hat\theta_a=A_a^{-1}b_a,$$

$$p_{t,a}=\underbrace{x_t^\top\hat\theta_a}_{\text{predicted reward}}+\underbrace{\alpha\sqrt{x_t^\top A_a^{-1}x_t}}_{\text{exploration bonus}},\qquad a_t=\arg\max_{a\in\mathcal A(C_t)}p_{t,a}.$$

After observing the selected candidate:

$$A_{a_t}\leftarrow A_{a_t}+x_tx_t^\top,\qquad b_{a_t}\leftarrow b_{a_t}+r_tx_t.$$

The implementation maintains $A=LL^\top$ with **rank-one Cholesky updates and triangular solves**, avoiding an explicit inverse. Both prediction and uncertainty use the same pre-update model. Ties use seeded random selection.

Linear Thompson Sampling uses the fixed-scale Gaussian linear model

$$\tilde\theta_a\sim\mathcal N(\hat\theta_a,\alpha^2A_a^{-1}),\qquad p_{t,a}=x_t^\top\tilde\theta_a.$$

The inspector shows expected reward, sampled reward and unscaled uncertainty $\sqrt{x^\top A^{-1}x}$; predictive sample standard deviation is $\alpha$ times that uncertainty. This is a Gaussian linear-model approximation for bounded, evolving rewards; it does not claim a calibrated posterior for circuit search. Contextual ε-Greedy uses the same ridge predictors without a bonus.

Legacy policies warm up available categories, then use a fixed affine reward normalization. For reward bounds $[r_{\min},r_{\max}]$, $\tilde r=(r-r_{\min})/(r_{\max}-r_{\min})$. UCB1 uses $\bar{\tilde r}_a+\sqrt{2\ln(t)/N_a}$, with total prior pulls $t$. Beta Thompson starts at Beta(1,1), samples an unbiased Bernoulli observation with probability $\tilde r$, and increments integer success/failure counts. It models randomized normalized outcomes, not deterministic accuracy gains. **All displayed scores are converted to raw reward units.** Random has no prediction; absent scores are shown as dashes.

The model inspector displays the largest absolute learned coefficients and the full coefficient vector. Correlated features and evolving states make these descriptive weights, **not causal effects or extracted rules**.

References: [Li et al., contextual-bandit recommendation / LinUCB](https://arxiv.org/abs/1003.0146), [Agrawal and Goyal, Thompson Sampling for contextual linear payoffs](https://proceedings.mlr.press/v28/agrawal13.html). These motivate the policies; their theoretical assumptions are not asserted for this demo.

## Reward and acceptance

Define complexity as $K(C)=\operatorname{gates}(C)+\beta\operatorname{depth}(C)$, with default $\beta=0.5$.

| Mode                     | Actual candidate reward                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |
| Accuracy Delta · default | $\Delta\operatorname{Acc}$                                                     |
| Absolute Quality         | $\operatorname{Acc}(C')$                                                       |
| Improvement + Complexity | $\Delta\operatorname{Acc}-\lambda\Delta K$                                     |
| Ternary improvement      | $\operatorname{sign}(\Delta\operatorname{Acc})$: +1 improved, 0 same, −1 worse |

The last mode follows the prompt's “Accept/Reject Reward” accuracy-sign definition; it is **not** the final acceptance flag. Complexity tie-breaks can accept a zero-accuracy-change proposal.

**Acceptance is separate from reward:** accept strictly higher accuracy, or equal accuracy with strictly smaller $K$. Reject everything else, including equal-accuracy/equal-complexity mutations. An absolute-quality reward may be positive while the candidate is rejected. A complexity-penalized reward may be negative while improved accuracy is accepted. The actual reward always trains the selected action.

Default $\lambda=0.01$ applies only to the complexity reward mode. The normalization bounds are `[0,1]` for absolute quality, `[-1,1]` for delta/ternary, and $[-B,B]$ with $B=1+\lambda(8+5\beta)$ for complexity. No adaptive reward rescaling occurs. Cumulative reward includes rejected proposals and can be negative despite improved retained accuracy.

## Oracle regret

Oracle mode samples one candidate for **every available category** on the same pre-mutation circuit. The selected category uses the **exact candidate actually proposed**. For these sampled rewards,

$$\operatorname{regret}_t=\max_a r_{t,a}^{\rm sampled}-r_{t,a_t}^{\rm sampled},\qquad R_T=\sum_{t=1}^T\operatorname{regret}_t.$$

The decision panel compares the selected and best sampled category, displays instant regret, and exposes all sampled alternatives. This is a **sampled counterfactual opportunity gap**, not an exhaustive best-mutation oracle, an expected-reward pseudo-regret estimate with guarantees, or a comparison to a globally optimal circuit.

Selection happens before evaluation. Unselected oracle results never update policy models, features, best accuracy, or acceptance. Candidate sampling uses deterministic streams keyed by seed, round and category. Turning the oracle on/off therefore preserves selected mutations and learning. Research always enables it; live mode can disable it and displays regret as **not measured**, not zero.

## Using the laboratory

- **Targets:** AND, OR, XOR, `(A XOR B) AND C`, `(A AND B) OR C`, Majority, three-bit Parity, Multiplexer (`C=0 → A`, `C=1 → B`), seeded random truth table, custom expression.
- **Presets:** EASY = AND, MEDIUM = `(A XOR B) AND C`, HARD = Majority; LinUCB exploration α=2 and exploitation α=0.05 demos. Other selected settings are retained.
- **Custom parser:** A/B/C, 0/1, parentheses, NOT, AND/NAND, XOR, OR/NOR; aliases `!`, `&`, `&&`, `^`, `|`, `||`. Precedence: NOT → AND/NAND → XOR → OR/NOR. No `eval` or `Function`.
- **Controls:** target, policy, seed, reward, context, α, ridge, λ, depth weight, budget and oracle changes restart the experiment. The seed arrow applies the draft. Speed changes preserve state.
- **Budget:** stops exactly at the selected round limit. STEP and START disable at completion; RESET starts a fresh identical run. Finding 100% is recorded but does not stop the experiment.
- **Probe:** selecting a truth-table row pauses to trace its signals. Evaluation always covers all eight inputs. Return to auto follows iteration modulo eight.
- **Animation:** candidate circuits appear briefly; rejected candidates revert, accepted structures remain. New and removed connections flash. Faster modes coalesce intermediate animation while retaining exact engine behavior. Reduced-motion settings disable CSS animation.
- **Inspection:** scores and decision context are frozen **before** selection/update; counts and coefficients include the update. Circuit and accuracy metrics show the retained state, while candidate previews and logs show proposed changes.
- **History:** last 240 chart samples and 80 logs; every log retains the complete selected context, predicted/actual reward and oracle gap. Aggregate statistics cover the full run. Reloading resets state; save research exports or reproduce from settings.

The exploratory-decision share is descriptive: Random/ε-random and legacy warm-up count as exploration; UCB/Thompson decisions count when the chosen predicted/empirical mean is below the best available mean. It is not a calibrated exploration probability.

## Research mode

Run **10, 50 or 100 paired trials**, with **250, 500 or 1,000 rounds** per trial. Three comparison types avoid an ambiguous all-settings cross-product:

1. **Policies:** Random, non-contextual UCB1, LinUCB, Linear Thompson Sampling.
2. **Rewards:** all four reward modes, fixing the policy to LinUCB.
3. **Contexts:** 12D, 18D and 35D profiles, fixing the policy to LinUCB.

Other configuration stays fixed. Trial $j$ uses seed `(base + j) mod 2^32`, the same initial NAND→OR circuit and the same target truth table. A random target is generated once from the base seed. Research overrides the live budget with its own and always enables oracle evaluation. Selection, mutation and posterior-update randomness are separate. Equal seeds pair trials but do not keep circuits identical after policies diverge.

Compare final accuracy (mean ± sample SD), mean best accuracy, solved fraction, censored fraction, median rounds to 100%, cumulative reward, cumulative sampled regret, final gate count/depth, accepted mutation count, final-accuracy histograms, and action distributions. The median includes **solved trials only**; unsolved trials remain censored at the budget. Read the solved fraction alongside it. Reward-design totals have different units and must not be ranked against each other; compare accuracy/success/complexity instead. Policies' regret is measured along their own evolving trajectories.

The Worker runs the same engine as live mode. Stop terminates it, retains completed trials and discards the in-flight trial. JSON export (`logic-garden-research-v2`) contains settings, exact observations, variant configurations, per-trial results and summaries. Partial experiments can be exported; groups may then have unequal counts.

Reproduce the committed ten-trial reference:

```bash
node --import tsx scripts/benchmark.ts > docs/benchmark-seed-42.json
```

For `(A XOR B) AND C`, seeds 42–51, 500 rounds, full context and default settings, the current reference reports:

| Policy          | Mean final accuracy | Solved | Mean sampled regret |
| --------------- | ------------------- | ------ | ------------------- |
| Random          | 75.00%              | 0/10   | 81.975              |
| UCB1            | 75.00%              | 0/10   | 61.600              |
| LinUCB          | 76.25%              | 0/10   | 45.575              |
| Linear Thompson | 81.25%              | 2/10   | 54.900              |

These are actual outputs, not a claim of universal superiority. Strict greedy acceptance often simplifies into a local optimum and cannot cross a neutral plateau. Lower sampled regret does not imply higher final accuracy. See the complete [reference JSON](docs/benchmark-seed-42.json).

## Architecture

```text
app/                           App Router entry point, metadata, theme
src/
  random.ts                    Seeded uniform, normal, gamma and Beta sampling
  algorithms/bandit/
    BanditPolicy.ts            Common selectAction / update / getActionStats interface
    linearAlgebra.ts           Disjoint ridge models and Cholesky solves
    linUCB.ts                  Context-dependent confidence score
    linearThompson.ts          Gaussian contextual posterior sampling
    epsilonGreedy.ts           Legacy empirical ε-Greedy
    ucb1.ts                    Legacy non-contextual UCB1
    thompsonSampling.ts        Legacy Beta Thompson
  circuit/
    circuit.ts                 DAG types, validation, pruning, limits
    evaluator.ts               Boolean signals and observed truth-table accuracy
    booleanFunctions.ts        Presets and safe expression parser
    mutations.ts               Target-independent candidate generation
    features.ts                Ordered context profiles and feature definitions
  simulation/
    simulator.ts               Select → evaluate → accept/reject → update
    reward.ts / acceptance.ts  Independent reward and acceptance policies
    oracle.ts                  Deterministic sampled counterfactual evaluation
    research.ts                Paired trials, variants and summaries
    research.worker.ts         Background execution and progress
  components/                  Circuit, context, action scores, decision, history, research
scripts/                       Headless benchmark and built-Worker check
tests/                         Deterministic numerical / engine regression tests
```

The core has no React, timer or network dependency. Candidate sets are cached while a circuit is unchanged; retained history is bounded. No matrix library or other dependency was added for contextual learning. The optional feature-detected `step_logic_garden` WebMCP adapter invokes the same STEP action; the app works without it.

See [implementation review](docs/REVIEW.md), [contributing](CONTRIBUTING.md), and [publication notes](docs/PUBLISHING.md). CI runs typecheck, lint, tests, build and the exact built Worker check. Browser interaction and responsive screenshot checks are not included in that verification.

## Future extensions

Hierarchical or combinatorial mutation policies, neural / graph embeddings, genetic-algorithm and Bayesian-optimization baselines, restarts or annealing, reinforcement learning / MCTS, noisy observations, larger circuits, Verilog export, FPGA synthesis, and SAT-solver comparison.

## License

MIT. Third-party packages retain their respective licenses.
