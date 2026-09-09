import { useState } from 'react';
import { ARMS, ARM_LABELS, type Arm } from '../circuit/mutations';
import { ALGORITHM_LABELS, type Algorithm } from '../algorithms/bandit';
import type { Snapshot } from '../simulation/simulator';
import { signed } from './MetricsPanel';
import { DecisionPanel } from './DecisionPanel';
const number = (v: number | undefined) =>
  v === undefined ? '—' : Number.isFinite(v) ? signed(v) : '∞';
export function ActionScorePanel({
  snapshot: s,
  algorithm,
}: {
  snapshot: Snapshot;
  algorithm: Algorithm;
}) {
  const [inspected, setInspected] = useState<Arm | null>(null);
  const selected = inspected ?? s.decision?.arm ?? 'change_gate';
  const coefficients = s.stats[selected].coefficients;
  const scale = Math.max(
    0.01,
    ...Object.values(s.decision?.scores ?? {})
      .flatMap((score) => [Math.abs(score.mean), Math.abs(score.bonus)])
      .filter(Number.isFinite),
  );
  return (
    <section className="action-section">
      <div className="section-heading">
        <h2>
          <span className="section-index">03</span> ACTION VALUES
        </h2>
        <span>{ALGORITHM_LABELS[algorithm]}</span>
      </div>
      <div className="action-grid">
        <div className="action-main">
          <div className="score-scroll">
            <table className="score-table">
              <thead>
                <tr>
                  <th>ACTION / INSPECT</th>
                  <th>PREDICTED r</th>
                  <th>UNCERTAINTY</th>
                  <th>
                    {algorithm.includes('thompson') ? 'SAMPLE OFFSET' : 'BONUS'}
                  </th>
                  <th>
                    {algorithm.includes('thompson')
                      ? 'SAMPLED r'
                      : 'FINAL SCORE'}
                  </th>
                  <th>PULLS</th>
                </tr>
              </thead>
              <tbody>
                {ARMS.map((arm) => {
                  const score = s.decision?.scores[arm];
                  return (
                    <tr
                      key={arm}
                      className={`${s.decision?.arm === arm ? 'chosen' : ''} ${selected === arm ? 'inspected' : ''}`}
                    >
                      <th>
                        <button
                          aria-pressed={selected === arm}
                          onClick={() => setInspected(arm)}
                        >
                          {s.decision?.arm === arm ? '→ ' : ''}
                          {ARM_LABELS[arm]}
                          {!s.available.includes(arm) ? ' ∅' : ''}
                        </button>
                      </th>
                      <td>
                        <span>{number(score?.mean)}</span>
                        <i
                          className={`score-meter expected ${score && score.mean < 0 ? 'below-zero' : ''}`}
                          style={{
                            width: `${Math.min(100, (Math.abs(score?.mean ?? 0) / scale) * 100)}%`,
                          }}
                        />
                      </td>
                      <td>{score?.uncertainty?.toFixed(3) ?? '—'}</td>
                      <td>
                        <span>{number(score?.bonus)}</span>
                        <i
                          className={`score-meter bonus ${score && score.bonus < 0 ? 'below-zero' : ''}`}
                          style={{
                            width: `${score && Number.isFinite(score.bonus) ? Math.min(100, (Math.abs(score.bonus) / scale) * 100) : 0}%`,
                          }}
                        />
                      </td>
                      <td className="total-score">{number(score?.score)}</td>
                      <td>{s.stats[arm].count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="score-key">
            <span>
              <i /> prediction
            </span>
            <span>
              <i /> exploration or posterior draw offset
            </span>
            <span>hatched = negative · ∅ currently unavailable</span>
          </p>
          <p className="micro-note">
            Scores are frozen before the last selection and update. A dash means
            no score was computed (Random, warm-up, or unavailable). Linear
            uncertainty is √(xᵀA⁻¹x); LinUCB bonus = α × uncertainty. Linear TS
            predictive sample SD = α × uncertainty.
          </p>
          <div className="coefficient-panel">
            <div className="detail-heading">
              <p className="eyebrow">
                LEARNED MODEL / {ARM_LABELS[selected]} · AFTER UPDATE
              </p>
              {inspected && (
                <button onClick={() => setInspected(null)}>
                  follow selection ↗
                </button>
              )}
            </div>
            {coefficients ? (
              <>
                <div className="coefficient-grid">
                  {s.context.features
                    .map((f, i) => ({ ...f, weight: coefficients[i]! }))
                    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
                    .slice(0, 8)
                    .map((f) => (
                      <div
                        key={f.key}
                        title={`${f.definition} Coefficient on the normalized feature.`}
                      >
                        <span>{f.label}</span>
                        <b className={f.weight < 0 ? 'negative' : 'green'}>
                          {signed(f.weight)}
                        </b>
                      </div>
                    ))}
                </div>
                <details>
                  <summary>
                    All {coefficients.length} coefficients in feature order
                  </summary>
                  <code>[{coefficients.map((v) => signed(v)).join(', ')}]</code>
                </details>
                <p className="micro-note">
                  Largest absolute coefficients, including the intercept.
                  Correlated features and changing search states make these
                  descriptive weights, not causal rules or calibrated effects.
                </p>
              </>
            ) : (
              <p className="micro-note">
                This policy does not fit a context model. Observed mean reward:{' '}
                {s.stats[selected].count
                  ? signed(
                      s.stats[selected].totalReward / s.stats[selected].count,
                    )
                  : '—'}{' '}
                · legal candidates now: {s.candidateCounts[selected] ?? 0}.
              </p>
            )}
          </div>
        </div>
        <DecisionPanel snapshot={s} />
      </div>
    </section>
  );
}
