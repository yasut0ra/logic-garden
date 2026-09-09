/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The scrollable history must be focusable for keyboard scrolling. */
import type { RoundLog } from '../simulation/simulator';
import { signed } from './MetricsPanel';
export function MutationLog({ logs }: { logs: RoundLog[] }) {
  return (
    <section className="log-panel">
      <div className="section-heading">
        <h2>
          <span className="section-index">04</span> FIELD NOTES
        </h2>
        <span>NEWEST FIRST / {logs.length}</span>
      </div>
      <section
        className="terminal-log"
        aria-label="Mutation history"
        tabIndex={0}
      >
        {!logs.length ? (
          <div className="log-empty">
            <span className="green">[00000] SYSTEM READY</span>
            <p>
              8 observations. 6 mutation categories. Waiting for context →
              action → reward.
            </p>
            <p>
              Waiting for the first decision<span className="cursor">_</span>
            </p>
          </div>
        ) : (
          logs.map((log) => (
            <div className="log-entry" key={log.iteration}>
              <span className="log-time">
                [{String(log.iteration).padStart(5, '0')}]
              </span>
              <div>
                <p>
                  <span className="log-operation">
                    {log.mutation.type.toUpperCase()}
                  </span>{' '}
                  {log.mutation.description}
                </p>
                <p className="log-detail">
                  accuracy {log.before.toFixed(3)} → {log.after.toFixed(3)}{' '}
                  <span>
                    actual r {signed(log.reward)} · predicted{' '}
                    {log.predicted === null ? '—' : signed(log.predicted)}
                  </span>
                </p>
                <details className="log-context">
                  <summary>
                    x[{log.context.length}] → {log.mutation.type} → online
                    update · regret{' '}
                    {log.instantRegret?.toFixed(3) ?? 'not measured'}
                  </summary>
                  <code>
                    [{log.context.map((v) => v.toFixed(3)).join(', ')}]
                  </code>
                  <p>{log.reason}</p>
                </details>
              </div>
              <span
                className={`log-result ${log.accepted ? 'green' : 'negative'}`}
              >
                {log.accepted ? 'ACCEPT' : 'REJECT'}
              </span>
            </div>
          ))
        )}
      </section>
    </section>
  );
}
