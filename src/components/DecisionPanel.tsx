import { ARM_LABELS } from '../circuit/mutations';
import type { Snapshot } from '../simulation/simulator';
import { signed } from './MetricsPanel';
export function DecisionPanel({ snapshot: s }: { snapshot: Snapshot }) {
  const d = s.decision,
    score = d?.scores[d.arm];
  return (
    <aside className="decision-detail decision-panel">
      <p className="eyebrow">LAST DECISION / ROUND {s.iteration}</p>
      <h3>{d ? ARM_LABELS[d.arm] : 'Awaiting first observation'}</h3>
      <dl>
        <div>
          <dt>Predicted reward</dt>
          <dd>{score ? signed(score.mean) : '—'}</dd>
        </div>
        <div>
          <dt>Exploration / sample offset</dt>
          <dd className="warm">{score ? signed(score.bonus) : '—'}</dd>
        </div>
        <div className="score-total">
          <dt>Selection score</dt>
          <dd>{score ? signed(score.score) : '—'}</dd>
        </div>
        <div>
          <dt>Actual candidate reward</dt>
          <dd className={s.reward < 0 ? 'negative' : 'green'}>
            {s.last ? signed(s.reward) : '—'}
          </dd>
        </div>
      </dl>
      <p className="decision-reason">
        {d?.reason ??
          'The current circuit becomes a feature vector. Each action estimates the reward of its next mutation.'}
      </p>
      {s.last && (
        <p className="update-note">
          <b className={s.last.accepted ? 'green' : 'negative'}>
            {s.last.accepted ? 'ACCEPT' : 'REJECT'}
          </b>{' '}
          · observation (x, a, r) recorded
          {s.stats[s.last.mutation.type].coefficients
            ? ' · selected linear model updated'
            : ' · selected action statistics updated'}
        </p>
      )}
      <div className="oracle-detail">
        <p className="eyebrow">SAMPLED ORACLE / SAME PRE-MUTATION CIRCUIT</p>
        {s.oracle ? (
          <>
            <dl>
              <div>
                <dt>Selected {ARM_LABELS[s.decision!.arm]}</dt>
                <dd>{signed(s.oracle.selectedReward)}</dd>
              </div>
              <div>
                <dt>Best {ARM_LABELS[s.oracle.bestArm]}</dt>
                <dd>{signed(s.oracle.bestReward)}</dd>
              </div>
              <div>
                <dt>Instant sampled regret</dt>
                <dd>{s.oracle.instantRegret.toFixed(3)}</dd>
              </div>
            </dl>
            <details>
              <summary>All counterfactual candidates</summary>
              {Object.entries(s.oracle.rewards).map(([arm, reward]) => (
                <p
                  key={arm}
                  title={
                    s.oracle!.descriptions[
                      arm as keyof typeof s.oracle.descriptions
                    ]
                  }
                >
                  {ARM_LABELS[arm as keyof typeof ARM_LABELS]}{' '}
                  <b>{signed(reward!)}</b>
                </p>
              ))}
            </details>
          </>
        ) : (
          <p>
            {s.cumulativeRegret === null
              ? 'Off · regret is not measured.'
              : 'One candidate per available category will be evaluated.'}
          </p>
        )}
        <p className="micro-note">
          Only the selected reward trains the policy. This sampled comparison is
          not an exhaustive oracle.
        </p>
      </div>
    </aside>
  );
}
