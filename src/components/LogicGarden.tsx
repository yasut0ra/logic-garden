'use client';
import { useCallback, useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CircuitBoard, FlaskConical } from 'lucide-react';
import {
  PRESETS,
  targetObservations,
  type TargetId,
} from '../circuit/booleanFunctions';
import {
  DEFAULT_CONFIG,
  Simulator,
  type SimulationConfig,
} from '../simulation/simulator';
import { ControlPanel, type Speed } from './ControlPanel';
import { CircuitCanvas } from './CircuitCanvas';
import { ActionScorePanel } from './ActionScorePanel';
import { ContextInspector } from './ContextInspector';
import { MetricsPanel } from './MetricsPanel';
import { HistoryChart } from './HistoryChart';
import { MutationLog } from './MutationLog';
import { TruthTable } from './TruthTable';
import { ResearchPanel } from './ResearchPanel';
import { MethodNotes } from './MethodNotes';
const INITIAL_TARGET: TargetId = 'xor-and';
const INITIAL_EXPRESSION = '(A XOR B) AND C';
export default function LogicGarden() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [target, setTarget] = useState<TargetId>(INITIAL_TARGET),
    [custom, setCustom] = useState(INITIAL_EXPRESSION);
  const [engine, setEngine] = useState(
    () =>
      new Simulator(
        DEFAULT_CONFIG,
        targetObservations(
          INITIAL_TARGET,
          DEFAULT_CONFIG.seed,
          INITIAL_EXPRESSION,
        ),
      ),
  );
  const [snapshot, setSnapshot] = useState(() => engine.snapshot());
  const [running, setRunning] = useState(false),
    [speed, setSpeed] = useState<Speed>('1');
  const [probe, setProbe] = useState<number | null>(null),
    [error, setError] = useState('');
  const [tab, setTab] = useState('live'),
    [experimentId, setExperimentId] = useState(0);
  const reset = useCallback(
    (
      nextConfig: SimulationConfig,
      nextTarget: TargetId,
      nextCustom: string,
    ) => {
      try {
        const observations = targetObservations(
          nextTarget,
          nextConfig.seed,
          nextCustom,
        );
        const next = new Simulator(nextConfig, observations);
        setRunning(false);
        setConfig(nextConfig);
        setTarget(nextTarget);
        setCustom(nextCustom);
        setEngine(next);
        setSnapshot(next.snapshot());
        setProbe(null);
        setError('');
        setExperimentId((id) => id + 1);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'Invalid experiment.',
        );
      }
    },
    [],
  );
  const advance = useCallback(
    (count: number) => {
      try {
        const result = engine.advance(count);
        setSnapshot(result);
        if (result.complete) setRunning(false);
        return result;
      } catch (caught) {
        setRunning(false);
        setError(
          caught instanceof Error ? caught.message : 'Simulation stopped.',
        );
        return null;
      }
    },
    [engine],
  );
  useEffect(() => {
    if (!running) return;
    const delay = speed === 'max' ? 40 : 700 / Number(speed);
    const timer = window.setInterval(
      () => advance(speed === 'max' ? 4 : 1),
      delay,
    );
    return () => window.clearInterval(timer);
  }, [advance, running, speed]);
  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setRunning(false);
    };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () =>
      document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);
  // Optional WebMCP adapter shares the same action and state as the STEP button.
  useEffect(() => {
    type Context = {
      registerTool: (
        tool: {
          name: string;
          description: string;
          inputSchema: object;
          annotations: { readOnlyHint: boolean };
          execute: (input: unknown) => Promise<unknown>;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'step_logic_garden',
            description:
              'Pause the live experiment, run 1–100 mutation rounds, and show the resulting circuit and metrics.',
            inputSchema: {
              type: 'object',
              properties: {
                rounds: { type: 'integer', minimum: 1, maximum: 100 },
              },
              required: ['rounds'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute: async (input) => {
              if (
                !input ||
                typeof input !== 'object' ||
                !('rounds' in input) ||
                Object.keys(input).length !== 1 ||
                !Number.isInteger(input.rounds) ||
                Number(input.rounds) < 1 ||
                Number(input.rounds) > 100
              )
                throw new Error('Provide integer rounds from 1 to 100.');
              setRunning(false);
              setTab('live');
              const result = advance(Number(input.rounds));
              if (!result) throw new Error('Simulation failed.');
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
              );
              return {
                iteration: result.iteration,
                accuracy: result.evaluation.accuracy,
                reward: result.reward,
                gates: result.size,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {
        /* The simulator works without optional browser integration. */
      });
    } catch {
      /* Unsupported experimental API. */
    }
    return () => lifecycle.abort();
  }, [advance]);
  const inputIndex = probe ?? snapshot.iteration % 8;
  const targetLabel =
    target === 'custom' ? custom : PRESETS.find((p) => p.id === target)!.label;
  return (
    <main className="garden-shell">
      <header className="masthead">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 10H18V24H29M5 38H18V24 M29 15V33H34A9 9 0 0 0 34 15Z M43 24H48" />
              <circle cx="5" cy="10" r="3" />
              <circle cx="5" cy="38" r="3" />
            </g>
          </svg>
        </div>
        <div>
          <h1>
            LOGIC GARDEN<span className="version"> / 002</span>
          </h1>
          <p>CONTEXTUAL CIRCUIT SEARCH</p>
        </div>
        <span className="header-note">
          THREE INPUTS. ONE UNKNOWN.
          <br />
          <span>AN EXPERIMENT IN LEARNING TO GROW</span>
        </span>
      </header>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(String(value));
          if (value === 'research') setRunning(false);
        }}
        className="garden-tabs"
      >
        <div className="view-bar">
          <TabsList variant="line" className="view-tabs">
            <TabsTrigger value="live">
              <CircuitBoard size={15} /> LIVE EXPERIMENT
            </TabsTrigger>
            <TabsTrigger value="research">
              <FlaskConical size={15} /> RESEARCH MODE
            </TabsTrigger>
          </TabsList>
          <span>
            Circuit state → context → action → candidate → reward → online
            update.
          </span>
        </div>
        <TabsContent value="live">
          <ControlPanel
            key={experimentId}
            config={config}
            target={target}
            custom={custom}
            running={running}
            speed={speed}
            iteration={snapshot.iteration}
            onPreset={(nextTarget, alpha) =>
              reset(
                { ...config, algorithm: 'linucb', alpha },
                nextTarget,
                custom,
              )
            }
            onConfig={(next) => reset(next, target, custom)}
            onTarget={(next, expression = custom) =>
              reset(config, next, expression)
            }
            onRunning={setRunning}
            onSpeed={setSpeed}
            onStep={() => advance(1)}
            onReset={() => reset(config, target, custom)}
          />
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          <section className="workspace">
            <CircuitCanvas
              key={`${experimentId}:${snapshot.iteration}`}
              snapshot={snapshot}
              inputIndex={inputIndex}
              running={running}
            />
            <ContextInspector key={experimentId} snapshot={snapshot} />
          </section>
          <MetricsPanel snapshot={snapshot} />
          <ActionScorePanel
            key={`actions-${experimentId}`}
            snapshot={snapshot}
            algorithm={config.algorithm}
          />
          <HistoryChart history={snapshot.history} />
          <div className="lower-grid">
            <MutationLog logs={snapshot.logs} />
            <TruthTable
              observations={engine.observations}
              predicted={snapshot.evaluation.predicted}
              selected={inputIndex}
              onSelect={(index) => {
                setProbe(index);
                setRunning(false);
              }}
            />
          </div>
          <div className="probe-note">
            <span>
              PROBE /{' '}
              {probe === null
                ? 'follows iteration'
                : `input ${inputIndex.toString(2).padStart(3, '0')}`}
            </span>
            {probe !== null && (
              <button onClick={() => setProbe(null)}>RETURN TO AUTO ↗</button>
            )}
            <span>
              All 8 inputs are evaluated every round, regardless of the selected
              probe.
            </span>
          </div>
        </TabsContent>
        <TabsContent value="research" keepMounted>
          <ResearchPanel
            key={experimentId}
            config={config}
            observations={[...engine.observations]}
            targetLabel={targetLabel}
          />
          <p className="research-settings-hint">
            Use Live Experiment to change the target, seed, model settings,
            context or reward. Research always measures sampled oracle regret.
          </p>
        </TabsContent>
      </Tabs>
      <MethodNotes />
      <footer className="footer">
        <span>LOGIC GARDEN / EXPERIMENTAL SYSTEMS</span>
        <span>6 MUTATION ARMS · 8 OBSERVATIONS · SEED {config.seed}</span>
        <span>
          DETERMINISTIC BY DESIGN <span className="green">↗</span>
        </span>
      </footer>
    </main>
  );
}
