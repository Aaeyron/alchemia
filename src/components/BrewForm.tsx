"use client";

import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";

const BUDGETS = [0, 50, 100, 500]; // pesos
const TIMES = [5, 10, 30, 60]; // minutes

type BrewFormProps = {
  goal: string;
  onGoalChange: (goal: string) => void;
  budget: number;
  onBudgetChange: (budget: number) => void;
  time: number;
  onTimeChange: (time: number) => void;
  brewing: boolean;
  onBrew: () => void;
  voice?: React.ReactNode; // optional mic button, shown under the goal input
  showButton?: boolean; // false = no Brew button here (pressing Enter still brews)
};

// Goal, budget and time inputs, plus the big "Brew possibilities" button.
export function BrewForm({
  goal,
  onGoalChange,
  budget,
  onBudgetChange,
  time,
  onTimeChange,
  brewing,
  onBrew,
  voice,
  showButton = true,
}: BrewFormProps) {
  const canBrew = goal.trim() !== "" && !brewing;

  return (
    <form
      className="panel bg-mint-soft"
      onSubmit={(event) => {
        event.preventDefault();
        if (canBrew) onBrew();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="h-panel">🎯 What do you need?</span>
        <input
          type="text"
          value={goal}
          onChange={(event) => onGoalChange(event.target.value)}
          placeholder="something useful for studying"
          maxLength={200}
          className="field"
        />
      </label>

      {voice}

      <fieldset>
        <legend className="h-sub mb-2">🪙 How much can you spend?</legend>
        <div className="flex flex-wrap gap-3">
          {BUDGETS.map((amount) => (
            <Chip
              key={amount}
              emoji="🪙"
              label={`₱${amount}`}
              selected={budget === amount}
              onToggle={() => onBudgetChange(amount)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="h-sub mb-2">⏱️ How much time do you have?</legend>
        <div className="flex flex-wrap gap-3">
          {TIMES.map((minutes) => (
            <Chip
              key={minutes}
              emoji="⏱️"
              label={`${minutes} min`}
              selected={time === minutes}
              onToggle={() => onTimeChange(minutes)}
            />
          ))}
        </div>
      </fieldset>

      {showButton && (
        <Button type="submit" variant="primary" size="large" disabled={!canBrew}>
          🧪 Brew possibilities
        </Button>
      )}
    </form>
  );
}
