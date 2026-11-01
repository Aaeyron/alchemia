// The 5 dots at the top: where you are, where you've been, and what's still locked.

export const STEPS = [
  { emoji: "📸", label: "Show" },
  { emoji: "🎯", label: "Need" },
  { emoji: "💡", label: "Ideas" },
  { emoji: "✨", label: "See it" },
  { emoji: "🛠️", label: "Build" },
];

type StepperProps = {
  current: number; // 1 to 5
  reachable: boolean[]; // one per step: can the user go there right now?
  onGo: (step: number) => void;
};

export function Stepper({ current, reachable, onGo }: StepperProps) {
  return (
    <nav aria-label="Steps" className="relative">
      {/* The line connecting the dots (from the first dot's center to the last one's). */}
      <div aria-hidden="true" className="absolute top-[26px] right-[10%] left-[10%] h-[3px] bg-ink" />

      <ol className="relative flex">
        {STEPS.map((step, i) => {
          const n = i + 1;
          const isCurrent = n === current;
          const canGo = !isCurrent && reachable[i];
          return (
            <li key={step.label} className="relative flex flex-1 flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => onGo(n)}
                disabled={!canGo}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${n}: ${step.label}`}
                className={`relative flex h-[52px] w-[52px] items-center justify-center rounded-full border-[3px] border-ink text-2xl focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-sky ${
                  isCurrent
                    ? "bg-sunny shadow-[3px_3px_0_var(--color-ink)]"
                    : canGo
                      ? "pressable bg-mint-soft"
                      : "border-dashed bg-white opacity-60"
                }`}
              >
                <span aria-hidden="true">{step.emoji}</span>
                {/* Little number badge in the corner */}
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-white text-sm font-bold"
                >
                  {n}
                </span>
              </button>
              {/* Phones: only the current step's label. Wider screens: all labels. */}
              <span
                aria-hidden="true"
                className={`text-sm ${isCurrent ? "font-bold" : "hidden font-medium sm:block"}`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Screen readers hear "Step 2 of 5: Need" whenever the step changes. */}
      <p aria-live="polite" className="sr-only">
        Step {current} of {STEPS.length}: {STEPS[current - 1].label}
      </p>
    </nav>
  );
}
