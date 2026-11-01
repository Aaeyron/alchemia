import { PencilUnderline, StarSticker } from "@/components/Doodles";

// The 5 steps as a school "star chart": every step you've unlocked gets a gold star sticker,
// the current one is underlined in pencil, and locked ones are dashed and faded.

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
    <nav aria-label="Steps" className="sticker bg-paper px-2 pt-4 pb-2 sm:px-4">
      <ol className="relative flex">
        {STEPS.map((step, i) => {
          const n = i + 1;
          const isCurrent = n === current;
          const canGo = !isCurrent && reachable[i];
          return (
            <li key={step.label} className="relative flex flex-1 flex-col items-center gap-1">
              {/* Dashed pencil line to the next dot (from this dot's center to the next one's). */}
              {n < STEPS.length && (
                <span
                  aria-hidden="true"
                  className="absolute top-[25px] left-1/2 w-full border-t-3 border-dashed border-graphite"
                />
              )}
              <button
                type="button"
                onClick={() => onGo(n)}
                disabled={!canGo}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${n}: ${step.label}${canGo ? " (done)" : ""}`}
                className={`relative flex h-[52px] w-[52px] items-center justify-center rounded-full border-thick border-ink text-2xl ${
                  isCurrent
                    ? "bg-sunny shadow-sticker-sm"
                    : canGo
                      ? "pressable bg-mint-soft shadow-sticker-sm"
                      : "border-dashed bg-white opacity-60"
                }`}
              >
                <span aria-hidden="true">{step.emoji}</span>
                {/* Little number badge in the corner */}
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-thin border-ink bg-white text-sm font-bold"
                >
                  {n}
                </span>
                {/* Gold star sticker for every unlocked step you're not on */}
                {canGo && <StarSticker className="absolute -top-2.5 -left-2.5 h-6 w-6 -rotate-12" />}
              </button>
              {/* Phones: only the current step's label (pencil-underlined). Wider screens: all labels. */}
              <span
                aria-hidden="true"
                className={`relative text-sm ${isCurrent ? "font-bold" : "hidden font-medium sm:block"}`}
              >
                {step.label}
                {isCurrent && <PencilUnderline className="absolute -bottom-1.5 left-0 h-2 w-full" />}
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
