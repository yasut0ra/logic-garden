import { useState } from 'react';
import { ARMS, ARM_LABELS, type Arm } from '../circuit/mutations';
import { type Algorithm } from '../algorithms/bandit';
import type { Snapshot } from '../simulation/simulator';
export function BanditPanel({
  snapshot: s,
  algorithm,
}: {
  snapshot: Snapshot;
  algorithm: Algorithm;
}) {
  const [inspected, setInspected] = useState<Arm | null>(null);
  const selected = inspected ?? s.decision?.arm ?? 'change_gate';
  const stats = s.stats[selected],
    score = s.decision?.scores[selected];
  const maxCount = Math.max(1, ...ARMS.map((arm) => s.stats[arm].count));
  return (
    <aside className="bandit-panel">
      <div className="section-heading">
        <h2>
          <span className="section-index">02</span> MUTATION ARMS
        </h2>
        <span>6 ARMS</span>
      </div>
      <div className="arm-table">
        <div className="arm-table-header">
          <span>CATEGORY</span>
          <span>PULLS</span>
          <span>MEAN r</span>
        </div>
        {ARMS.map((arm, i) => (
          <button
            key={arm}
            className={`arm-row ${selected === arm ? 'selected' : ''} ${s.decision?.arm === arm ? 'last-selected' : ''}`}
            onClick={() => setInspected(arm)}
            aria-pressed={selected === arm}
            aria-label={`Inspect ${ARM_LABELS[arm]}, ${s.stats[arm].count} selections`}
          >
            <span className="arm-name">
              <span className="arm-number">0{i + 1}</span>
              {ARM_LABELS[arm]}
              {!s.available.includes(arm) && (
                <span
                  className="unavailable"
                  title="No legal candidates in the current circuit"
                >
                  ∅
                </span>
              )}
            </span>
            <span>{s.stats[arm].count}</span>
            <span className={s.stats[arm].totalReward < 0 ? 'negative' : ''}>
              {s.stats[arm].count
                ? (s.stats[arm].totalReward / s.stats[arm].count).toFixed(3)
                : '—'}
            </span>
            <span
              className="arm-meter"
              style={{ width: `${(s.stats[arm].count / maxCount) * 100}%` }}
            />
          </button>
        ))}
      </div>
      <div className="decision-detail">
        <div className="detail-heading">
          <p className="eyebrow">
            {inspected ? 'INSPECTING ARM' : 'WHY THIS ARM?'}
          </p>
          {inspected && (
            <button onClick={() => setInspected(null)}>follow live ↗</button>
          )}
        </div>
        <h3>{ARM_LABELS[selected]}</h3>
        <dl>
          <div>
            <dt>Normalized mean¹</dt>
            <dd>{score ? score.mean.toFixed(3) : '—'}</dd>
          </div>
          {algorithm === 'ucb1' && (
            <>
              <div>
                <dt>Exploration bonus¹</dt>
                <dd className="warm">{score?.bonus.toFixed(3) ?? 'untried'}</dd>
              </div>
              <div className="score-total">
                <dt>UCB score¹</dt>
                <dd>{score?.score.toFixed(3) ?? '∞ / warm-up'}</dd>
              </div>
            </>
          )}
          {algorithm === 'thompson' && (
            <>
              <div>
                <dt>Posterior α / β</dt>
                <dd>
                  {stats.alpha} / {stats.beta}
                </dd>
              </div>
              <div className="score-total">
                <dt>Sampled θ¹</dt>
                <dd>{score?.score.toFixed(3) ?? 'warm-up'}</dd>
              </div>
            </>
          )}
          {algorithm === 'epsilon-greedy' && (
            <div className="score-total">
              <dt>Selection mode</dt>
              <dd>
                {s.decision
                  ? s.decision.exploratory
                    ? 'explore'
                    : 'exploit'
                  : 'warm-up'}
              </dd>
            </div>
          )}
          <div>
            <dt>Cumulative reward</dt>
            <dd>{stats.totalReward.toFixed(3)}</dd>
          </div>
          <div>
            <dt>Legal candidates</dt>
            <dd>{s.candidateCounts[selected] ?? 0}</dd>
          </div>
        </dl>
        <p className="decision-reason">
          {inspected
            ? 'Arm estimates include accepted and rejected proposals.'
            : (s.decision?.reason ??
              'First, try each available category once. Then learn where to search.')}
        </p>
        <div className="exploration-key">
          <span>
            <i /> EXPLOITATION
          </span>
          <span>
            <i /> EXPLORATION
          </span>
        </div>
        <p className="micro-note">
          ¹ Scores are from before the last pull. ∅ = currently unavailable.
        </p>
      </div>
    </aside>
  );
}
