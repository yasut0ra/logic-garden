/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Inline SVG diagrams need an explicit accessible image role. */
import {
  circuitExpression,
  nodeDepths,
  type CircuitNode,
} from '../circuit/circuit';
import { ALL_INPUTS, evaluateSignals } from '../circuit/evaluator';
import type { Snapshot } from '../simulation/simulator';
function GateShape({ type }: { type: CircuitNode['type'] }) {
  if (type === 'NOT')
    return (
      <>
        <path d="M-48 0H-30 M34 0H48" />
        <path d="M-30-26 L22 0 L-30 26 Z" />
        <circle cx="28" r="6" />
      </>
    );
  if (type === 'AND' || type === 'NAND')
    return (
      <>
        <path
          d={`M-48-14H-34 M-48 14H-34 M${type === 'NAND' ? 40 : 28} 0H48`}
        />
        <path d="M-34-28 H0 A28 28 0 0 1 0 28 H-34 Z" />
        {type === 'NAND' && <circle cx="34" r="6" />}
      </>
    );
  return (
    <>
      <path d={`M-48-14H-23 M-48 14H-23 M${type === 'NOR' ? 46 : 34} 0H48`} />
      <path d="M-32-28 Q-8 0 -32 28 Q10 28 34 0 Q10-28-32-28 Z" />
      {type === 'XOR' && <path d="M-40-28 Q-16 0 -40 28" fill="none" />}
      {type === 'NOR' && <circle cx="40" r="6" />}
    </>
  );
}
export function CircuitCanvas({
  snapshot: s,
  inputIndex,
  running,
}: {
  snapshot: Snapshot;
  inputIndex: number;
  running: boolean;
}) {
  const depths = nodeDepths(s.circuit),
    signals = evaluateSignals(s.circuit, ALL_INPUTS[inputIndex]!);
  const positions: Record<string, { x: number; y: number }> = {};
  const columns = s.depth + 1;
  for (const node of s.circuit.nodes) {
    const layer = s.circuit.nodes.filter(
      (n) => n.type !== 'OUTPUT' && depths[n.id] === depths[node.id],
    );
    const index = layer.findIndex((n) => n.id === node.id);
    positions[node.id] =
      node.type === 'OUTPUT'
        ? { x: 806, y: 205 }
        : {
            x: 94 + (depths[node.id]! * 650) / columns,
            y: 60 + ((index + 1) * 290) / (layer.length + 1),
          };
  }
  const last = s.last;
  return (
    <section className="circuit-area" aria-label="Live circuit">
      <div className="section-heading">
        <h2>
          <span className="section-index">01</span> THE GARDEN
        </h2>
        <span className={`status ${running ? 'running' : ''}`}>
          <i />
          {running ? 'GROWING' : s.iteration ? 'PAUSED' : 'READY TO GROW'}
        </span>
      </div>
      <div className={`circuit-stage ${running ? 'is-running' : ''}`}>
        <div className="canvas-top">
          <span>
            gθ / GENERATION {String(s.acceptedCount).padStart(4, '0')}
          </span>
          <span>DAG · 3 → 1</span>
        </div>
        <svg
          className="circuit-svg"
          viewBox="0 0 900 405"
          role="img"
          aria-label={`Current circuit: ${circuitExpression(s.circuit)}. Input ${ALL_INPUTS[inputIndex]!.join('')}, output ${signals.Y}.`}
        >
          {s.circuit.edges.map((edge) => {
            const source = positions[edge.source]!,
              target = positions[edge.target]!;
            const node = s.circuit.nodes.find((n) => n.id === edge.target)!;
            const startX = source.x + (depths[edge.source] === 0 ? 20 : 48),
              endX = target.x - (edge.target === 'Y' ? 25 : 48);
            const endY =
              target.y +
              (node.inputs.length === 2 ? (edge.port === 0 ? -14 : 14) : 0);
            const midpoint =
              startX + (endX - startX) * (0.4 + edge.port * 0.15);
            const d = `M${startX} ${source.y} H${midpoint - 8} Q${midpoint} ${source.y} ${midpoint} ${source.y + Math.sign(endY - source.y) * 8} V${endY - Math.sign(endY - source.y) * 8} Q${midpoint} ${endY} ${midpoint + 8} ${endY} H${endX}`;
            const active = signals[edge.source] === 1;
            return (
              <g
                key={`${edge.source}-${edge.target}-${edge.port}`}
                className={`signal-wire ${active ? 'high' : 'low'}`}
              >
                <path
                  d={d}
                  strokeWidth={
                    1.3 + Math.min(s.nodeActivity[edge.source] ?? 0, 1.8)
                  }
                />
                {active && <path className="signal-travel" d={d} />}
                <circle
                  cx={startX}
                  cy={source.y}
                  r="2.4"
                  fill="currentColor"
                  stroke="none"
                />
              </g>
            );
          })}
          {s.circuit.nodes.map((node) => {
            const p = positions[node.id]!,
              terminal = node.type === 'INPUT' || node.type === 'OUTPUT';
            const used =
              node.type === 'OUTPUT' ||
              s.circuit.edges.some((e) => e.source === node.id);
            const changed = last?.mutation.targetNode === node.id;
            return (
              <g
                key={node.id}
                transform={`translate(${p.x} ${p.y})`}
                className={`circuit-node ${signals[node.id] ? 'high' : 'low'} ${!used ? 'unused' : ''}`}
              >
                <title>
                  {node.id}: {node.type}, signal {signals[node.id]}
                </title>
                {changed && (
                  <circle
                    key={last.iteration}
                    r="47"
                    className={`mutation-ring ${last.accepted ? '' : 'rejected'}`}
                  />
                )}
                <g
                  className="gate-body"
                  style={{
                    strokeWidth:
                      1.5 + Math.min(s.nodeActivity[node.id] ?? 0, 0.8),
                  }}
                >
                  {terminal ? (
                    <>
                      {node.type === 'OUTPUT' && <circle r="25" />}
                      <circle r="20" />
                    </>
                  ) : (
                    <GateShape type={node.type} />
                  )}
                </g>
                <text
                  className="signal-value"
                  textAnchor="middle"
                  x={terminal ? 0 : node.type === 'NOT' ? -12 : -7}
                  y="5"
                >
                  {signals[node.id]}
                </text>
                {terminal ? (
                  <text
                    className="terminal-label"
                    x={node.type === 'INPUT' ? -38 : 40}
                    y="6"
                    textAnchor={node.type === 'INPUT' ? 'end' : 'start'}
                  >
                    {node.id}
                  </text>
                ) : (
                  <>
                    <text className="node-id" textAnchor="middle" y="-43">
                      {node.id.toUpperCase()}
                    </text>
                    <text className="gate-label" textAnchor="middle" y="54">
                      {node.type}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
        <div className="canvas-legend">
          <span>
            <i className="legend-dot high" />
            HIGH / 1
          </span>
          <span>
            <i className="legend-dot" />
            LOW / 0
          </span>
          <span>── SIGNAL FLOW</span>
        </div>
      </div>
      <div className="circuit-expression">
        <span>gθ(x) =</span>
        <code title={circuitExpression(s.circuit)}>
          {circuitExpression(s.circuit)}
        </code>
      </div>
      <div
        className={`mutation-status ${last?.accepted ? 'accepted' : last ? 'rejected' : ''}`}
      >
        <span className="mutation-status-icon">
          {last ? (last.accepted ? '↗' : '↳') : '⌁'}
        </span>
        <div>
          <p>
            {last
              ? last.mutation.description
              : 'An untrained circuit. A place to begin.'}
          </p>
          <span>
            {last
              ? `ROUND ${String(last.iteration).padStart(5, '0')} / ${last.accepted ? (last.reward > 0 ? 'ACCEPTED · IMPROVEMENT' : 'ACCEPTED · NEUTRAL MOVE') : 'REJECTED · CIRCUIT RETAINED'}`
              : 'PRESS START TO BEGIN EXPLORATION'}
          </span>
        </div>
        <strong>
          {last
            ? `${last.reward >= 0 ? '+' : ''}${last.reward.toFixed(3)}`
            : '—'}
        </strong>
      </div>
    </section>
  );
}
