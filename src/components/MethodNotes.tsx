export function MethodNotes() {
  return (
    <details className="method-notes">
      <summary>
        <span>READ THE EXPERIMENT</span>
        <span>
          CONTEXT, LEARNING & REGRET <b>+</b>
        </span>
      </summary>
      <div className="method-grid">
        <div>
          <h3>01 / State-dependent decisions</h3>
          <p>
            The learner observes the fixed truth table on all 8 inputs. Features
            summarize the current circuit and selected search history, never the
            target expression or unselected oracle outcomes. Each action is a
            mutation category; a concrete legal change is sampled uniformly.
          </p>
          <code>circuit → x → action → candidate → reward → update</code>
          <p>
            Full context adds recent search statistics and eight error bits.
            Structural and performance + structural profiles support ablation
            experiments.
          </p>
        </div>
        <div>
          <h3>02 / Reward ≠ acceptance</h3>
          <p>
            Four rewards: accuracy change; candidate accuracy; accuracy change
            minus λ × complexity change; or sign of the accuracy change.
            Complexity is gates + β × depth.
          </p>
          <p>
            Accept strictly higher accuracy, or equal accuracy with strictly
            lower complexity. Otherwise reject. Every selected candidate trains
            the policy on its actual reward, including rejected proposals.
          </p>
        </div>
        <div>
          <h3>03 / Disjoint linear models</h3>
          <code>score = xᵀθ + α √(xᵀA⁻¹x)</code>
          <p>
            LinUCB adds uncertainty to a ridge reward prediction. Linear
            Thompson samples θ̃ from N(θ, α²A⁻¹). Contextual ε-Greedy uses the
            same prediction with occasional random choices. Each action has its
            own model; only the selected model updates A ← A + xxᵀ and b ← b +
            rx.
          </p>
          <p>
            UCB1 and legacy ε-Greedy use normalized empirical rewards. Legacy
            Beta Thompson uses Bernoulli resampling of normalized rewards. All
            displayed scores are in raw reward units.
          </p>
        </div>
        <div>
          <h3>04 / A sampled comparison</h3>
          <code>regret = max sampled reward − selected reward</code>
          <p>
            Oracle mode evaluates one candidate from each available category on
            the same current circuit, including the exact selected candidate. It
            measures a sampled opportunity gap, not the best of all mutations.
            Research always enables it; off means unmeasured.
          </p>
          <p>
            At most 8 gates, depth 5. Greedy acceptance can trap the search at a
            local optimum. States and reward distributions evolve; classical
            contextual-bandit guarantees do not apply to this adaptive local
            search. Learned weights are descriptive, not causal rules.
          </p>
        </div>
      </div>
    </details>
  );
}
