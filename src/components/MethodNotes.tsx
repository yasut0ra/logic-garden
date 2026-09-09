export function MethodNotes() {
  return (
    <details className="method-notes">
      <summary>
        <span>READ THE EXPERIMENT</span>
        <span>
          ARMS, REWARD & REGRET <b>+</b>
        </span>
      </summary>
      <div className="method-grid">
        <div>
          <h3>01 / A black-box target</h3>
          <p>
            The learner observes f(x) on all 8 inputs. It cannot access the
            Boolean expression. A mutation category is an arm; a legal change
            within that category is sampled uniformly.
          </p>
          <code>category → mutation → evaluate → reward</code>
        </div>
        <div>
          <h3>02 / Reward & acceptance</h3>
          <p>
            Every proposal updates the bandit, including rejected changes.
            Nonnegative rewards are accepted. Neutral moves let the circuit
            explore a plateau.
          </p>
          <code>r = Δaccuracy − λ × Δgates</code>
          <p>
            UCB and ε-Greedy use r̃ = (r + B)/(2B), B = 1 + 6λ. Thompson samples
            Beta(α, β), then updates it using a Bernoulli(r̃) draw. The table
            displays raw mean rewards.
          </p>
        </div>
        <div>
          <h3>03 / Read regret carefully</h3>
          <code>regretₜ = best_accuracy_seen − current_accuracy</code>
          <p>
            Current accuracy is measured after acceptance. Regret is usually
            zero under this monotone search; zero does not imply the target has
            been solved. This is a best-seen pseudo regret, not oracle regret.
          </p>
        </div>
        <div>
          <h3>04 / Limits of the garden</h3>
          <p>
            At most 6 gates and depth 3. Greedy acceptance may stop at a local
            optimum; 100% accuracy is not guaranteed. Random targets may exceed
            the circuit budget.
          </p>
          <p>
            Exploratory decisions count warm-up and ε-random choices, or
            UCB/Thompson choices below the highest empirical mean. This is a
            descriptive rate, not a calibrated exploration probability.
          </p>
        </div>
      </div>
    </details>
  );
}
