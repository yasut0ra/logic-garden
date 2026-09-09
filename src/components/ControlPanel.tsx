import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Pause, StepForward, RotateCcw, ArrowRight } from 'lucide-react';
import { Choice } from './Choice';
import { ALGORITHMS, ALGORITHM_LABELS } from '../algorithms/bandit';
import { PRESETS, type TargetId } from '../circuit/booleanFunctions';
import type { SimulationConfig } from '../simulation/simulator';
export type Speed = '1' | '5' | '20' | 'max';
interface Props {
  config: SimulationConfig;
  target: TargetId;
  custom: string;
  running: boolean;
  speed: Speed;
  iteration: number;
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
        <div className="penalty-field">
          <span className="eyebrow">COMPLEXITY PENALTY</span>
          <label>
            <Checkbox
              checked={p.config.penalty > 0}
              onCheckedChange={(checked) =>
                p.onConfig({ ...p.config, penalty: checked ? 0.01 : 0 })
              }
              aria-label="Penalize gate count"
            />
            λ = 0.01 <span>{p.config.penalty ? 'ON' : 'OFF'}</span>
          </label>
        </div>
      </section>
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
          >
            {p.running ? <Pause size={15} /> : <Play size={15} />}{' '}
            {p.running ? 'PAUSE' : 'START'}
          </button>
          <button className="action" onClick={p.onStep} disabled={p.running}>
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
        {p.config.algorithm === 'epsilon-greedy' && (
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
          <span>ITERATION</span>
          <strong>{String(p.iteration).padStart(6, '0')}</strong>
        </div>
      </div>
      <p className="settings-note">
        Target, strategy, seed and penalty changes restart the experiment. Speed
        changes preserve it.
      </p>
    </>
  );
}
