"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { DifficultyStars, IngredientStickers } from "@/components/IngredientStickers";
import { SafetyBox } from "@/components/SafetyBox";
import { StickerCard } from "@/components/StickerCard";
import type { BuildGuide, Ingredient } from "@/lib/types";

type BuildModeProps = {
  guide: BuildGuide;
  current: number; // index of the step on screen
  done: boolean[]; // checkmarks, one per step
  ingredients: Ingredient[]; // the shared list, for colors
  picture?: React.ReactNode; // the step's picture area (painted pictures, or a note)
  onDone: () => void; // "✓ Done": check this step and go on
  onBack: () => void; // the step before (or the preview, on step 1)
  onJump: (index: number) => void; // a step in the list was tapped
};

// One build step at a time, on notebook paper, with a progress bar and the list of all steps.
export function BuildMode({ guide, current, done, ingredients, picture, onDone, onBack, onJump }: BuildModeProps) {
  const step = guide.steps[current];
  const total = guide.steps.length;
  const isLast = current === total - 1;
  const doneCount = done.filter(Boolean).length;

  // Every new step moves focus to its title, so screen readers start reading the new step.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [current]);

  return (
    <div className="flex flex-col gap-section">
      {/* A new key per step replays the slide-in (switched off for reduced motion). */}
      <StickerCard key={current} tone="paper" as="article" className="step-in">
        <div>
          <p className="caption">
            Step {current + 1} of {total}
          </p>
          <h3 ref={heading} tabIndex={-1} className="h-panel">
            {done[current] && (
              <>
                <span aria-hidden="true">✓</span>
                <span className="sr-only">Done: </span>
              </>
            )}
            {step.title}
          </h3>
        </div>

        {picture}

        <p className="text-lg leading-relaxed">{step.instruction}</p>

        {step.ingredients.length > 0 && (
          <IngredientStickers names={step.ingredients} ingredients={ingredients} label="Ingredients for this step" />
        )}
        {step.tools.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="hint">Used as tools:</p>
            <IngredientStickers names={step.tools} ingredients={ingredients} label="Tools for this step" />
          </div>
        )}

        <p className="flex flex-wrap gap-x-4 gap-y-1 text-base font-medium">
          <span>⏱️ {step.minutes} min</span>
          <DifficultyStars level={step.difficulty} />
        </p>

        {step.tip && (
          <p className="rounded-control border-thin border-ink bg-sunny-soft px-3 py-2 text-base">
            <span aria-hidden="true">💡 </span>
            <span className="sr-only">Tip: </span>
            {step.tip}
          </p>
        )}

        {step.safety && <SafetyBox>{step.safety}</SafetyBox>}

        <div className="flex gap-3">
          <Button onClick={onBack} className="min-h-12">
            {current === 0 ? "← Preview" : "← Back"}
          </Button>
          <Button variant="primary" onClick={onDone} className="min-h-12 flex-1">
            {isLast ? "✓ Done, finish!" : "✓ Done, next step"}
          </Button>
        </div>
      </StickerCard>

      <StickerCard tone="white" emoji="🗒️" title="All steps" headingLevel="h4">
        <div
          role="progressbar"
          aria-label="Steps done"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneCount}
          aria-valuetext={`${doneCount} of ${total} steps done`}
          className="h-4 overflow-hidden rounded-full border-thin border-ink bg-white"
        >
          <div
            className="h-full bg-mint motion-safe:transition-[width] motion-safe:duration-300"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </div>

        <ol className="flex flex-col gap-2">
          {guide.steps.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-current={i === current ? "step" : undefined}
                className={`pressable flex min-h-11 w-full items-center gap-3 rounded-control border-thin border-ink px-3 py-1 text-left text-base ${
                  i === current ? "bg-sunny-soft font-semibold" : "bg-white"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-thin border-ink ${
                    done[i] ? "bg-mint" : "bg-white"
                  }`}
                >
                  {done[i] ? "✓" : i + 1}
                </span>
                <span>
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                  {done[i] && <span className="sr-only"> (done)</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </StickerCard>

      {guide.fallback && <p className="hint">Simple guide (detailed guide unavailable right now).</p>}
    </div>
  );
}
