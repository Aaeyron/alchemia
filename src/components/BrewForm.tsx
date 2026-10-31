"use client";

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
}: BrewFormProps) {
  const canBrew = goal.trim() !== "" && !brewing;

  return (
    <form
      className="sticker flex flex-col gap-5 bg-mint-soft p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (canBrew) onBrew();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-2xl font-semibold">What do you need?</span>
        <input
          type="text"
          value={goal}
          onChange={(event) => onGoalChange(event.target.value)}
          placeholder="something useful for studying"
          maxLength={200}
          className="sticker min-h-12 rounded-2xl bg-white px-4 py-3 text-lg placeholder:text-ink/60 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-sky"
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-lg font-semibold">How much can you spend?</legend>
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
        <legend className="mb-2 text-lg font-semibold">How much time do you have?</legend>
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

      <button
        type="submit"
        disabled={!canBrew}
        className="sticker pressable min-h-14 bg-pink px-6 py-3 text-xl font-bold disabled:pointer-events-none disabled:opacity-50"
      >
        🧪 Brew possibilities
      </button>
    </form>
  );
}
