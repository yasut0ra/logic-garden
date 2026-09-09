/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The feature list must allow keyboard scrolling. */
import { useState } from 'react';
import type { Snapshot } from '../simulation/simulator';
import { CONTEXT_LABELS } from '../circuit/features';
export function ContextInspector({ snapshot: s }: { snapshot: Snapshot }) {
  const [current, setCurrent] = useState(false);
  const context = current || !s.decisionContext ? s.context : s.decisionContext;
  return (
    <aside className="context-panel">
      <div className="section-heading">
        <h2>
          <span className="section-index">02</span> CONTEXT INSPECTOR
        </h2>
        <span>{context.vector.length}D</span>
      </div>
      <div className="context-toolbar">
        <button
          className={!current ? 'active' : ''}
          onClick={() => setCurrent(false)}
          aria-pressed={!current}
        >
          AT SELECTION
        </button>
        <button
          className={current ? 'active' : ''}
          onClick={() => setCurrent(true)}
          aria-pressed={current}
        >
          CURRENT
        </button>
      </div>
      <p className="context-caption">
        {current || !s.decisionContext
          ? `After round ${context.iteration} · input for the next decision`
          : `Before round ${s.iteration} · the x used to select and update`}
        <br />
        {CONTEXT_LABELS[context.mode]}
      </p>
      <dl
        className="feature-list"
        tabIndex={0}
        aria-label="Normalized context features"
      >
        {context.features
          .filter((f) => f.group !== 'bias' && f.group !== 'error')
          .map((f) => (
            <div key={f.key} title={f.definition}>
              <dt>{f.label}</dt>
              <dd>
                {f.value.toFixed(3)}
                <span className="feature-track">
                  <i
                    className={f.value < 0 ? 'negative-fill' : ''}
                    style={{ width: `${Math.abs(f.value) * 100}%` }}
                  />
                </span>
              </dd>
            </div>
          ))}
      </dl>
      {context.mode === 'full' && (
        <div className="error-pattern">
          <p className="eyebrow">ERROR PATTERN / 1 = INCORRECT</p>
          <div>
            {context.features
              .filter((f) => f.group === 'error')
              .map((f) => (
                <span
                  key={f.key}
                  title={f.definition}
                  className={f.value ? 'wrong' : ''}
                >
                  <small>{f.key.slice(6)}</small>
                  <b>{f.value}</b>
                </span>
              ))}
          </div>
        </div>
      )}
      <details className="vector-detail">
        <summary>FEATURE VECTOR / including bias</summary>
        <code>[{context.vector.map((v) => v.toFixed(3)).join(', ')}]</code>
        <p>
          Hover a feature for its definition. Reward features are signed; all
          others are scaled to 0–1.
        </p>
      </details>
    </aside>
  );
}
