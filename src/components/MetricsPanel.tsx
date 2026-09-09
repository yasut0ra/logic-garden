import type { Snapshot } from '../simulation/simulator';
export const signed = (n: number, digits = 3) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;
export function MetricsPanel({ snapshot: s }: { snapshot: Snapshot }) {
  return (
    <section className="metrics-strip" aria-label="Experiment metrics">
      <div className="metric accuracy-metric">
        <span className="eyebrow">ACCURACY</span>
        <strong>
          {(s.evaluation.accuracy * 100).toFixed(1)}
          <small>%</small>
        </strong>
        <span className="metric-meta">
          <span className="mini-blocks">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} className={i < s.evaluation.correct ? 'filled' : ''} />
            ))}
          </span>
          {s.evaluation.correct}/8 inputs
        </span>
      </div>
      <div className="metric">
        <span className="eyebrow">CURRENT REWARD</span>
        <strong className={s.reward < 0 ? 'negative' : 'green'}>
          {signed(s.reward)}
        </strong>
        <span className="metric-meta">
          Σ reward <b>{signed(s.cumulativeReward, 2)}</b>
        </span>
      </div>
      <div className="metric">
        <span className="eyebrow">BEST ACCURACY</span>
        <strong>
          {(s.bestAccuracy * 100).toFixed(1)}
          <small>%</small>
        </strong>
        <span className="metric-meta">
          {s.solvedAt === null
            ? 'still searching'
            : `first solved at ${s.solvedAt}`}
        </span>
      </div>
      <div className="metric">
        <span className="eyebrow">CUMULATIVE REGRET</span>
        <strong>{s.cumulativeRegret?.toFixed(3) ?? '—'}</strong>
        <span className="metric-meta">
          {s.cumulativeRegret === null
            ? 'oracle off · not measured'
            : 'sampled candidate comparison'}
        </span>
      </div>
      <div className="metric structure-metric">
        <span className="eyebrow">CIRCUIT SIZE / DEPTH</span>
        <strong>
          {s.size}
          <small>/8</small>
          <span className="metric-divider">·</span>
          {s.depth}
          <small>/5</small>
        </strong>
        <span className="metric-meta">
          exploratory decisions{' '}
          <b>
            {s.iteration
              ? ((s.exploratoryCount / s.iteration) * 100).toFixed(0)
              : '0'}
            %
          </b>
        </span>
      </div>
    </section>
  );
}
