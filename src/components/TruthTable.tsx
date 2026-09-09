import type { Observation } from '../circuit/evaluator';
import type { Bit } from '../circuit/circuit';
export function TruthTable({
  observations,
  predicted,
  selected,
  onSelect,
}: {
  observations: readonly Observation[];
  predicted: Bit[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <section className="truth-panel">
      <div className="section-heading">
        <h2>
          <span className="section-index">05</span> TRUTH TABLE
        </h2>
        <span>CLICK TO PROBE</span>
      </div>
      <div className="truth-head">
        <span>A B C</span>
        <span>f(x)</span>
        <span>gθ(x)</span>
        <span>match</span>
      </div>
      {observations.map((row, index) => (
        <button
          className={`truth-row ${selected === index ? 'selected' : ''}`}
          key={index}
          aria-pressed={selected === index}
          aria-label={`Probe input ${row.input.join('')}, target ${row.expected}, prediction ${predicted[index]}`}
          onClick={() => onSelect(index)}
        >
          <span>{row.input.join(' ')}</span>
          <span>{row.expected}</span>
          <span>{predicted[index]}</span>
          <span
            className={predicted[index] === row.expected ? 'green' : 'negative'}
          >
            {predicted[index] === row.expected ? '✓' : '×'}
          </span>
        </button>
      ))}
      <p className="truth-note">
        The learner sees these observations, never the target expression.
      </p>
    </section>
  );
}
