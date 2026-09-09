/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Inline SVG diagrams need an explicit accessible image role. */
import type { HistoryPoint } from '../simulation/simulator';
const CHARTS = [
  {
    key: 'accuracy',
    label: 'ACCURACY',
    color: 'var(--primary)',
    min: 0,
    max: 1,
  },
  {
    key: 'reward',
    label: 'REWARD',
    color: 'var(--orange)',
    min: -0.25,
    max: 0.25,
  },
  { key: 'regret', label: 'Σ REGRET', color: 'var(--mint)', min: 0, max: 1 },
  {
    key: 'size',
    label: 'GATE COUNT',
    color: 'var(--muted-foreground)',
    min: 0,
    max: 6,
  },
] as const;
export function HistoryChart({ history }: { history: HistoryPoint[] }) {
  return (
    <section className="history-panel">
      <div className="section-heading">
        <h2>
          <span className="section-index">03</span> GROWTH RECORD
        </h2>
        <span>LAST {history.length} SAMPLES</span>
      </div>
      <div className="history-grid">
        {CHARTS.map((chart) => {
          const values = history.map((point) => point[chart.key]);
          const min = Math.min(chart.min, ...values),
            max = Math.max(chart.max, ...values),
            range = max - min || 1;
          const y = (v: number) => 69 - ((v - min) / range) * 58;
          const path = values
            .map(
              (v, i) =>
                `${i ? 'L' : 'M'}${2 + (i / Math.max(1, values.length - 1)) * 276} ${y(v)}`,
            )
            .join(' ');
          const final = values.at(-1) ?? 0;
          return (
            <div className="spark-chart" key={chart.key}>
              <div>
                <span>{chart.label}</span>
                <b style={{ color: chart.color }}>
                  {chart.key === 'accuracy'
                    ? `${(final * 100).toFixed(1)}%`
                    : final.toFixed(chart.key === 'size' ? 0 : 3)}
                </b>
              </div>
              <svg
                viewBox="0 0 280 80"
                role="img"
                aria-label={`${chart.label}, ${history[0]?.iteration} to ${history.at(-1)?.iteration}, latest ${final}`}
              >
                <path
                  d={`M0 ${y(0)}H280 M0 11H280 M0 69H280`}
                  className="chart-grid"
                />
                <path
                  d={path}
                  fill="none"
                  stroke={chart.color}
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={values.length > 1 ? 278 : 2}
                  cy={y(final)}
                  r="2.5"
                  fill={chart.color}
                />
              </svg>
              <div className="chart-axis">
                <span>{history[0]?.iteration.toString().padStart(4, '0')}</span>
                <span>
                  t / {history.at(-1)?.iteration.toString().padStart(4, '0')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
