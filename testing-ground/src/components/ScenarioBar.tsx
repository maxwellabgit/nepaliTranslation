import type { ScenarioCommandId, ScenarioState } from '../bridge/types';

const COMMANDS: { id: ScenarioCommandId; label: string }[] = [
  { id: 'reset', label: 'Reset' },
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
