"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { DifficultyStars, IngredientStickers } from "@/components/IngredientStickers";
import { Polaroid } from "@/components/Polaroid";
import { SafetyBox } from "@/components/SafetyBox";
import { StickerCard } from "@/components/StickerCard";
import type { BuildGuide, Ingredient } from "@/lib/types";

type BuildPreviewProps = {
  title: string; // the idea's title
  guide: BuildGuide;
  picture: string | null; // the concept picture, if this version has one
  ingredients: Ingredient[]; // the shared list, for colors
  onStart: () => void;
};

// Everything needed before building, on one screen: picture, time, steps, difficulty,
// ingredients, tools and the steps that need care.
export function BuildPreview({ title, guide, picture, ingredients, onStart }: BuildPreviewProps) {
  const { overview, steps } = guide;

  // The preview replaces the "Start Build Mode" button: move focus to its heading.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <StickerCard tone="paper" className="pop-in">
      <h3 ref={heading} tabIndex={-1} className="h-panel">
        <span aria-hidden="true">📋</span>
        Build preview
      </h3>

      {picture && (
        <div className="mx-auto w-full max-w-56 pt-3">
          <Polaroid
            src={picture}
            alt={`Concept picture of ${title}`}
            label="AI concept picture"
            tilt="-rotate-1"
            tape="tape-mint"
          />
        </div>
      )}

      <p className="flex flex-wrap gap-x-2 gap-y-1 text-lg font-medium">
        <span>⏱️ about {overview.totalMinutes} min</span>
        <span aria-hidden="true">·</span>
        <span>{overview.stepCount} steps</span>
        <span aria-hidden="true">·</span>
        <span>
          <span aria-hidden="true">difficulty </span>
          <DifficultyStars level={overview.maxDifficulty} />
        </span>
      </p>

      <div className="flex flex-col gap-2">
        <h4 className="h-sub">What you need</h4>
        <IngredientStickers names={overview.ingredients} ingredients={ingredients} label="Ingredients you need" />
        {overview.tools.length > 0 && (
          <>
            <p className="hint">Used as tools:</p>
            <IngredientStickers names={overview.tools} ingredients={ingredients} label="Tools you need" />
          </>
        )}
      </div>

      {overview.safetySteps.length > 0 && (
        <SafetyBox title="Steps that need care">
          <ul className="flex flex-col gap-1">
            {overview.safetySteps.map((number) => (
              <li key={number}>
                <strong>Step {number}:</strong> {steps[number - 1].safety}
              </li>
            ))}
          </ul>
        </SafetyBox>
      )}

      <div className="flex flex-col gap-2">
        <h4 className="h-sub">The steps</h4>
        <ol className="flex list-inside list-decimal flex-col gap-1 text-base">
          {steps.map((step, i) => (
            <li key={i}>{step.title}</li>
          ))}
        </ol>
      </div>

      {guide.fallback && <p className="hint">Simple guide (detailed guide unavailable right now).</p>}

      <Button variant="primary" size="large" onClick={onStart}>
        🛠️ Let&apos;s build it!
      </Button>
    </StickerCard>
  );
}
