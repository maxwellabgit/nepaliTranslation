import type { ScenarioCommandId, ScenarioState } from '../bridge/types';

const COMMANDS: { id: ScenarioCommandId; label: string }[] = [
  { id: 'load', label: 'Load' },
  { id: 'step', label: 'Step' },
  { id: 'run', label: 'Run' },
  { id: 'cancel', label: 'Cancel' },
  { id: 'reset', label: 'Reset' },
  { id: 'seed', label: 'Seed' },
  { id: 'export', label: 'Export' },
];

type Props = {
  scenario: ScenarioState;
  onCommand: (command: ScenarioCommandId) => void;
};

export function ScenarioBar({ scenario, onCommand }: Props) {
  return (
    <div className="tg-scenario">
      {COMMANDS.map((c) => (
        <button key={c.id} type="button" onClick={() => onCommand(c.id)}>
          {c.label}
        </button>
      ))}
      <div className="tg-scenario-status">
        {scenario.name} · {scenario.status} · step {scenario.stepIndex} · seed{' '}
        {scenario.seed}
      </div>
    </div>
  );
}
