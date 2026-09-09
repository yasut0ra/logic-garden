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
import { ALGORITHM_LABELS } from '../algorithms/bandit';
import type { Observation } from '../circuit/evaluator';
import type { SimulationConfig } from '../simulation/simulator';
import { summarizeTrials, type TrialResult } from '../simulation/research';
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
  const [trials, setTrials] = useState('5'),
    [rounds, setRounds] = useState('500');
  const [results, setResults] = useState<TrialResult[]>([]),
    [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready for a controlled experiment.');
  const [runInfo, setRunInfo] = useState<{
    trials: number;
    rounds: number;
  } | null>(null);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const start = () => {
    worker.current?.terminate();
    setResults([]);
    setBusy(true);
    setRunInfo({ trials: Number(trials), rounds: Number(rounds) });
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
    const data = {
      format: 'logic-garden-research-v1',
      config,
      target: targetLabel,
      observations,
      ...runInfo,
      results,
      summaries: summarizeTrials(results),
    };
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
          <p className="eyebrow">CONTROLLED COMPARISON / THREE STRATEGIES</p>
          <h2>Same garden. Different instincts.</h2>
          <p>
            Compare how mutation strategies learn on the same Boolean target.
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
          λ <b>{config.penalty.toFixed(2)}</b>
        </span>
        <span>
          ε <b>{config.epsilon.toFixed(2)}</b>
        </span>
      </div>
      <div className="research-controls">
        <Choice
          id="trials"
          label="PAIRED TRIALS"
          value={trials}
          options={['5', '10', '20'].map((v) => ({
            value: v,
            label: `${v} per strategy`,
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
          value={runInfo ? (results.length / (runInfo.trials * 3)) * 100 : 0}
        >
          <ProgressLabel>
            {busy ? 'RUNNING EXPERIMENT' : 'EXPERIMENT STATUS'}
          </ProgressLabel>
          <ProgressValue>
            {() =>
              `${results.length} / ${runInfo ? runInfo.trials * 3 : Number(trials) * 3}`
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
                <TableHead>STRATEGY</TableHead>
                <TableHead>FINAL ACC. ± SD</TableHead>
                <TableHead>SOLVED</TableHead>
                <TableHead>MEDIAN t → 100%¹</TableHead>
                <TableHead>Σ REWARD</TableHead>
                <TableHead>Σ REGRET</TableHead>
                <TableHead>GATES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((row) => (
                <TableRow key={row.algorithm}>
                  <TableCell>{ALGORITHM_LABELS[row.algorithm]}</TableCell>
                  <TableCell className="green">
                    {row.trials
                      ? `${(row.finalAccuracy * 100).toFixed(1)} ± ${(row.standardDeviation * 100).toFixed(1)}%`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {row.solved}/{row.trials}
                  </TableCell>
                  <TableCell>{row.medianSolvedAt ?? '—'}</TableCell>
                  <TableCell>
                    {row.trials ? signed(row.cumulativeReward, 2) : '—'}
                  </TableCell>
                  <TableCell>
                    {row.trials ? row.cumulativeRegret.toFixed(3) : '—'}
                  </TableCell>
                  <TableCell>
                    {row.trials ? row.size.toFixed(1) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="comparison-bars">
            {summaries.map((row) => (
              <div key={row.algorithm}>
                <span>{ALGORITHM_LABELS[row.algorithm]}</span>
                <div>
                  <i style={{ width: `${row.finalAccuracy * 100}%` }} />
                </div>
                <b>{(row.finalAccuracy * 100).toFixed(1)}%</b>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="research-empty">
          <span>ε</span>
          <span>UCB</span>
          <span>β</span>
          <p>
            Three strategies. One oracle.
            <br />
            Run a comparison to see where each one grows.
          </p>
        </div>
      )}
      <div className="research-notes">
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
          guarantees do not apply.
        </p>
      </div>
    </section>
  );
}
