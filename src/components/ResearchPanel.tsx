'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import { FlaskConical, Download, Square } from 'lucide-react';
import { ARMS, ARM_LABELS } from '../circuit/mutations';
import type { Observation } from '../circuit/evaluator';
import type { SimulationConfig } from '../simulation/simulator';
import {
  COMPARISONS,
  COMPARISON_LABELS,
  researchVariants,
  researchExport,
  summarizeTrials,
  type Comparison,
  type TrialResult,
} from '../simulation/research';
import { Choice } from './Choice';
import { signed } from './MetricsPanel';
export function ResearchPanel({
  config,
  observations,
  targetLabel,
}: {
  config: SimulationConfig;
  observations: Observation[];
  targetLabel: string;
}) {
  const [trials, setTrials] = useState('10'),
    [rounds, setRounds] = useState('500');
  const [comparison, setComparison] = useState<Comparison>('algorithms');
  const [results, setResults] = useState<TrialResult[]>([]),
    [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready for a controlled experiment.');
  const [runInfo, setRunInfo] = useState<{
    trials: number;
    rounds: number;
    comparison: Comparison;
    variants: number;
  } | null>(null);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const start = () => {
    worker.current?.terminate();
    setResults([]);
    setBusy(true);
    setRunInfo({
      trials: Number(trials),
      rounds: Number(rounds),
      comparison,
      variants: researchVariants(config, comparison).length,
    });
    setStatus('Running paired trials in the background…');
    try {
      const instance = new Worker(
        new URL('../simulation/research.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.current = instance;
      instance.onmessage = (
        event: MessageEvent<{
          type: string;
          results?: TrialResult[];
          message?: string;
        }>,
      ) => {
        if (event.data.results) setResults(event.data.results);
        if (event.data.type === 'complete' || event.data.type === 'error') {
          setBusy(false);
          setStatus(
            event.data.type === 'complete'
              ? 'Experiment complete. All paired trials recorded.'
              : (event.data.message ?? 'Experiment failed.'),
          );
          instance.terminate();
          worker.current = null;
        }
      };
      instance.onerror = () => {
        setBusy(false);
        setStatus('The research worker could not run. Please retry.');
        instance.terminate();
        worker.current = null;
      };
      instance.postMessage({
        comparison,
        config,
        observations,
        trials: Number(trials),
        rounds: Number(rounds),
      });
    } catch (error) {
      setBusy(false);
      setStatus(error instanceof Error ? error.message : 'Worker unavailable.');
    }
  };
  const download = () => {
    if (!runInfo) return;
    const data = researchExport(
      {
        config,
        observations,
        trials: runInfo.trials,
        rounds: runInfo.rounds,
        comparison: runInfo.comparison,
      },
      targetLabel,
      results,
    );
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `logic-garden-seed-${config.seed}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const summaries = summarizeTrials(results);
  return (
    <section className="research-panel">
      <div className="research-intro">
        <div>
          <p className="eyebrow">PAIRED SEEDS / SAMPLED ORACLE</p>
          <h2>Same garden. Different instincts.</h2>
          <p>
            Compare policies, reward designs, or context features on the same
            Boolean target.
          </p>
        </div>
        <FlaskConical size={42} strokeWidth={1} />
      </div>
      <div className="research-context">
        <span>
          TARGET <b>{targetLabel}</b>
        </span>
        <span>
          BASE SEED <b>{config.seed}</b>
        </span>
        <span>
          λ <b>{config.penalty}</b>
        </span>
        <span>
          α <b>{config.alpha}</b> · RIDGE <b>{config.ridge}</b>
        </span>
      </div>
      <div className="research-controls">
        <Choice
          id="comparison"
          label="COMPARE"
          value={comparison}
          options={COMPARISONS.map((value) => ({
            value,
            label: COMPARISON_LABELS[value],
          }))}
          onChange={setComparison}
          disabled={busy}
        />
        <Choice
          id="trials"
          label="PAIRED TRIALS"
          value={trials}
          options={['10', '50', '100'].map((v) => ({
            value: v,
            label: `${v} per variant`,
          }))}
          onChange={setTrials}
          disabled={busy}
        />
        <Choice
          id="rounds"
          label="ROUNDS / TRIAL"
          value={rounds}
          options={['250', '500', '1000'].map((v) => ({ value: v, label: v }))}
          onChange={setRounds}
          disabled={busy}
        />
        <button className="action primary" onClick={start} disabled={busy}>
          <FlaskConical size={16} /> RUN COMPARISON
        </button>
        {busy && (
          <button
            className="action"
            onClick={() => {
              worker.current?.terminate();
              worker.current = null;
              setBusy(false);
              setStatus(
                'Stopped. Completed trials are shown; the current trial was discarded.',
              );
            }}
          >
            <Square size={13} /> STOP
          </button>
        )}
        {results.length > 0 && (
          <button className="action" onClick={download} disabled={busy}>
            <Download size={15} /> EXPORT JSON
          </button>
        )}
      </div>
      <div className="research-progress">
        <Progress
          value={
            runInfo
              ? (results.length / (runInfo.trials * runInfo.variants)) * 100
              : 0
          }
        >
          <ProgressLabel>
            {busy ? 'RUNNING EXPERIMENT' : 'EXPERIMENT STATUS'}
          </ProgressLabel>
          <ProgressValue>
            {() =>
              `${results.length} / ${runInfo ? runInfo.trials * runInfo.variants : Number(trials) * researchVariants(config, comparison).length}`
            }
          </ProgressValue>
        </Progress>
        <output>{status}</output>
      </div>
      {results.length ? (
        <>
          <Table className="research-table">
            <TableHeader>
              <TableRow>
                <TableHead>VARIANT</TableHead>
                <TableHead>FINAL ACC. ± SD</TableHead>
                <TableHead>BEST ACC.</TableHead>
                <TableHead>SOLVED / CENSORED</TableHead>
                <TableHead>MEDIAN t → 100%¹</TableHead>
                <TableHead>Σ REWARD</TableHead>
                <TableHead>Σ REGRET</TableHead>
                <TableHead>GATES / DEPTH</TableHead>
                <TableHead>ACCEPTED</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((row) => (
                <TableRow key={row.variant}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="green">
                    {row.trials
                      ? `${(row.finalAccuracy * 100).toFixed(1)} ± ${(row.standardDeviation * 100).toFixed(1)}%`
                      : '—'}
                  </TableCell>
                  <TableCell>{(row.bestAccuracy * 100).toFixed(1)}%</TableCell>
                  <TableCell>
                    {row.solved}/{row.trials} ·{' '}
                    {((row.censored / row.trials) * 100).toFixed(0)}% censored
                  </TableCell>
                  <TableCell>{row.medianSolvedAt ?? '—'}</TableCell>
                  <TableCell>
                    {row.trials ? signed(row.cumulativeReward, 2) : '—'}
                  </TableCell>
                  <TableCell>
                    {row.trials ? row.cumulativeRegret.toFixed(3) : '—'}
                  </TableCell>
                  <TableCell>
                    {row.size.toFixed(1)} / {row.depth.toFixed(1)}
                  </TableCell>
                  <TableCell>{row.accepted.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="micro-note">
            {runInfo && COMPARISON_LABELS[runInfo.comparison]} ·{' '}
            {runInfo?.rounds} rounds per trial · final accuracy distribution
            below
          </p>
          <div className="comparison-bars">
            {summaries.map((row) => (
              <div key={row.variant}>
                <span>{row.label}</span>
                <div>
                  <i style={{ width: `${row.finalAccuracy * 100}%` }} />
                </div>
                <b>{(row.finalAccuracy * 100).toFixed(1)}%</b>
              </div>
            ))}
          </div>
          <div className="distribution-grid">
            {summaries.map((row) => (
              <div key={row.variant}>
                <h3>{row.label}</h3>
                <div
                  className="accuracy-histogram"
                  aria-label={`Final accuracy distribution for ${row.label}`}
                >
                  {Array.from({ length: 9 }, (_, i) => {
                    const count = results.filter(
                      (r) =>
                        r.variant === row.variant && r.finalAccuracy === i / 8,
                    ).length;
                    return (
                      <div
                        key={i}
                        title={`${((i / 8) * 100).toFixed(1)}% accuracy: ${count} trials`}
                      >
                        <b>{count || ''}</b>
                        <span
                          style={{ height: `${(count / row.trials) * 80}px` }}
                        />
                        <small>{i}/8</small>
                      </div>
                    );
                  })}
                </div>
                <p className="eyebrow">ACTION DISTRIBUTION / TOTAL PULLS</p>
                {ARMS.map((arm) => (
                  <div className="distribution-arm" key={arm}>
                    <span>{ARM_LABELS[arm]}</span>
                    <i
                      style={{
                        width: `${
                          (row.actions[arm] /
                            Math.max(
                              1,
                              Object.values(row.actions).reduce(
                                (a, b) => a + b,
                                0,
                              ),
                            )) *
                          100
                        }%`,
                      }}
                    />
                    <b>{row.actions[arm]}</b>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="research-empty">
          <span>x</span>
          <span>θ</span>
          <span>r</span>
          <p>
            A controlled view of online decisions.
            <br />
            Run a comparison to see where each one grows.
          </p>
        </div>
      )}
      <div className="research-notes">
        <p>
          Reward-design totals use different units and should not be ranked
          against each other. Compare final accuracy, success, and complexity
          across reward modes. All unselected oracle rewards are withheld from
          learning.
        </p>
        <p>
          Each paired trial uses seed (base + trial index) and the same initial
          circuit. The target truth table stays fixed, including for random
          targets. Random streams for selection, mutations and posterior updates
          are separate.
        </p>
        <p>
          Results show means and sample standard deviation. ¹ Median rounds to
          100% includes solved trials only; unsolved trials are censored at the
          round budget. Compare the solved fraction alongside this number.
        </p>
        <p>
          Arms change their reward distributions as the circuit changes. This is
          a nonstationary search experiment; classical stationary-bandit regret
          guarantees do not apply. Regret compares one sampled candidate per
          available category on each policy’s own evolving circuit; trajectories
          diverge. It does not establish globally optimal search.
        </p>
      </div>
    </section>
  );
}
