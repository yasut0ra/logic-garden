import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Pause, StepForward, RotateCcw, ArrowRight } from 'lucide-react';
import { Choice } from './Choice';
import { ALGORITHMS, ALGORITHM_LABELS } from '../algorithms/bandit';
import { PRESETS, type TargetId } from '../circuit/booleanFunctions';
import { CONTEXT_LABELS, CONTEXT_MODES } from '../circuit/features';
import { REWARD_LABELS, REWARD_MODES } from '../simulation/reward';
import type { SimulationConfig } from '../simulation/simulator';
export type Speed = '1' | '5' | '20' | 'max';
interface Props {
  config: SimulationConfig;
  target: TargetId;
  custom: string;
  running: boolean;
  speed: Speed;
  iteration: number;
  onPreset: (target: TargetId, alpha: number) => void;
  onConfig: (config: SimulationConfig) => void;
  onTarget: (id: TargetId, custom?: string) => void;
  onRunning: (running: boolean) => void;
  onSpeed: (speed: Speed) => void;
  onStep: () => void;
  onReset: () => void;
}
export function ControlPanel(p: Props) {
  const [seedDraft, setSeedDraft] = useState(String(p.config.seed));
  const [expression, setExpression] = useState(p.custom);
  const [seedError, setSeedError] = useState('');
  return (
    <>
      <section className="settings-row" aria-label="Experiment settings">
        <Choice
          id="target"
          label="TARGET FUNCTION / f(x)"
          value={p.target}
          options={PRESETS.map((v) => ({ value: v.id, label: v.label }))}
          onChange={(id) => p.onTarget(id)}
        />
        <Choice
          id="algorithm"
          label="BANDIT STRATEGY"
          value={p.config.algorithm}
          options={ALGORITHMS.map((value) => ({
            value,
            label: ALGORITHM_LABELS[value],
          }))}
          onChange={(algorithm) => p.onConfig({ ...p.config, algorithm })}
        />
        <form
          className="seed-field"
          onSubmit={(event) => {
            event.preventDefault();
            const seed = Number(seedDraft);
            if (
              !seedDraft.trim() ||
              !Number.isInteger(seed) ||
              seed < 0 ||
              seed > 0xffffffff
            ) {
              setSeedError('Seed must be 0–4294967295.');
              return;
            }
            setSeedError('');
            p.onConfig({ ...p.config, seed });
          }}
        >
          <label htmlFor="seed" className="eyebrow">
            RANDOM SEED
          </label>
          <div>
            <input
              id="seed"
              type="number"
              min="0"
              max="4294967295"
              step="1"
              value={seedDraft}
              onChange={(e) => setSeedDraft(e.target.value)}
              aria-describedby={seedError ? 'seed-error' : undefined}
            />
            <button
              aria-label="Apply seed and reset"
              title="Apply seed and reset"
            >
              <ArrowRight size={16} />
            </button>
          </div>
          {seedError && (
            <span id="seed-error" role="alert" className="negative">
              {seedError}
            </span>
          )}
        </form>
        <Choice
          id="reward"
          label="CANDIDATE REWARD"
          value={p.config.rewardMode}
          options={REWARD_MODES.map((value) => ({
            value,
            label: REWARD_LABELS[value],
          }))}
          onChange={(rewardMode) => p.onConfig({ ...p.config, rewardMode })}
        />
      </section>
      <div className="preset-row">
        <span className="eyebrow">LOAD PRESET</span>
        {(
          [
            { label: 'EASY', target: 'and', alpha: 0.5 },
            { label: 'MEDIUM', target: 'xor-and', alpha: 0.5 },
            { label: 'HARD', target: 'majority', alpha: 0.5 },
            { label: 'EXPLORE / α 2', target: p.target, alpha: 2 },
            { label: 'EXPLOIT / α .05', target: p.target, alpha: 0.05 },
          ] as const
        ).map((preset) => (
          <button
            key={preset.label}
            onClick={() => p.onPreset(preset.target, preset.alpha)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <details className="advanced-settings">
        <summary>
          MODEL & SEARCH SETTINGS <span>Changes restart the experiment</span>
        </summary>
        <div className="advanced-grid">
          <Choice
            id="context"
            label="CONTEXT FEATURES"
            value={p.config.contextMode}
            options={CONTEXT_MODES.map((value) => ({
              value,
              label: CONTEXT_LABELS[value],
            }))}
            onChange={(contextMode) => p.onConfig({ ...p.config, contextMode })}
          />
          <Choice
            id="alpha"
            label="EXPLORATION α / LINEAR"
            value={String(p.config.alpha)}
            options={[0, 0.05, 0.1, 0.5, 1, 2, 5].map((v) => ({
              value: String(v),
              label: String(v),
            }))}
            onChange={(value) =>
              p.onConfig({ ...p.config, alpha: Number(value) })
            }
          />
          <Choice
            id="ridge"
            label="RIDGE / INITIAL A"
            value={String(p.config.ridge)}
            options={[0.01, 0.1, 1, 10, 100].map((v) => ({
              value: String(v),
              label: `${v} × I`,
            }))}
            onChange={(value) =>
              p.onConfig({ ...p.config, ridge: Number(value) })
            }
          />
          <Choice
            id="penalty"
            label="COMPLEXITY PENALTY λ"
            value={String(p.config.penalty)}
            options={[0, 0.005, 0.01, 0.025, 0.05, 0.1, 0.2].map((v) => ({
              value: String(v),
              label: String(v),
            }))}
            onChange={(value) =>
              p.onConfig({ ...p.config, penalty: Number(value) })
            }
            disabled={p.config.rewardMode !== 'complexity'}
          />
          <Choice
            id="depth-weight"
            label="DEPTH WEIGHT β"
            value={String(p.config.depthWeight)}
            options={[0, 0.25, 0.5, 1, 2].map((v) => ({
              value: String(v),
              label: String(v),
            }))}
            onChange={(value) =>
              p.onConfig({ ...p.config, depthWeight: Number(value) })
            }
          />
          <Choice
            id="budget"
            label="ROUND BUDGET"
            value={String(p.config.maxIterations)}
            options={[250, 500, 1000, 2500, 10000].map((v) => ({
              value: String(v),
              label: String(v),
            }))}
            onChange={(value) =>
              p.onConfig({ ...p.config, maxIterations: Number(value) })
            }
          />
          <label className="oracle-switch" htmlFor="oracle-enabled">
            <Checkbox
              id="oracle-enabled"
              checked={p.config.oracle}
              onCheckedChange={(oracle) =>
                p.onConfig({ ...p.config, oracle: Boolean(oracle) })
              }
            />{' '}
            SAMPLED ORACLE
          </label>
        </div>
        <p className="micro-note">
          Complexity = gates + β × depth. β also breaks accuracy ties for
          acceptance. Linear settings apply to context policies; α controls
          LinUCB optimism and Linear TS sampling scale.
        </p>
      </details>
      {p.target === 'custom' && (
        <form
          className="expression-form"
          onSubmit={(e) => {
            e.preventDefault();
            p.onTarget('custom', expression);
          }}
        >
          <label htmlFor="expression">f(x) =</label>
          <input
            id="expression"
            value={expression}
            maxLength={300}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="(A XOR B) AND C"
          />
          <button className="action" type="submit">
            APPLY EXPRESSION ↗
          </button>
          <span>A B C · NOT · AND/NAND · XOR · OR/NOR · parentheses</span>
        </form>
      )}
      <div className="transport">
        <div className="transport-buttons">
          <button
            className="action primary"
            onClick={() => p.onRunning(!p.running)}
            disabled={p.iteration >= p.config.maxIterations}
          >
            {p.running ? <Pause size={15} /> : <Play size={15} />}{' '}
            {p.iteration >= p.config.maxIterations
              ? 'COMPLETE'
              : p.running
                ? 'PAUSE'
                : 'START'}
          </button>
          <button
            className="action"
            onClick={p.onStep}
            disabled={p.running || p.iteration >= p.config.maxIterations}
          >
            <StepForward size={16} /> STEP
          </button>
          <button className="action reset-button" onClick={p.onReset}>
            <RotateCcw size={14} /> RESET
          </button>
        </div>
        <Choice
          id="speed"
          label="SPEED"
          value={p.speed}
          options={[
            { value: '1', label: '1×' },
            { value: '5', label: '5×' },
            { value: '20', label: '20×' },
            { value: 'max', label: 'MAX' },
          ]}
          onChange={p.onSpeed}
        />
        {['epsilon-greedy', 'contextual-epsilon'].includes(
          p.config.algorithm,
        ) && (
          <Choice
            id="epsilon"
            label="EPSILON"
            value={String(p.config.epsilon)}
            options={[0.05, 0.1, 0.15, 0.3, 0.5, 1].map((v) => ({
              value: String(v),
              label: String(v),
            }))}
            onChange={(value) =>
              p.onConfig({ ...p.config, epsilon: Number(value) })
            }
          />
        )}
        <div className="iteration">
          <span>ITERATION / {p.config.maxIterations}</span>
          <strong>{String(p.iteration).padStart(6, '0')}</strong>
        </div>
      </div>
      <p className="settings-note">
        Every selected candidate trains the policy, including rejected
        mutations. Speed changes preserve the run.
      </p>
    </>
  );
}
