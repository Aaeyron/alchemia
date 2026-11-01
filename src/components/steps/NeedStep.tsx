"use client";

import type { RefObject } from "react";
import { BrewForm } from "@/components/BrewForm";
import { StepShell } from "@/components/StepShell";
import { emojiFor } from "@/lib/emoji";
import type { Ingredient } from "@/lib/types";

type NeedStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  say: string; // the mascot's line
  bubbling: boolean;
  selectedIngredients: Ingredient[];
  goal: string;
  onGoalChange: (goal: string) => void;
  budget: number;
  onBudgetChange: (budget: number) => void;
  time: number;
  onTimeChange: (time: number) => void;
  brewing: boolean;
  canBrew: boolean;
  brewBlockedReason: string; // why Brew is disabled (when it is)
  onBrew: () => void;
  voice: React.ReactNode;
  onBack: () => void;
  useEverything: boolean;
  onUseEverythingChange: (useEverything: boolean) => void;
};

// Step 2: what do you need, and how much money and time do you have?
export function NeedStep(props: NeedStepProps) {
  const { selectedIngredients } = props;

  return (
    <StepShell
      emoji="🎯"
      title="Need"
      instruction="Tell Alchemia what you want to make, and how much money and time you have."
      say={props.say}
      bubbling={props.bubbling}
      headingRef={props.headingRef}
      back={{ label: "← Back", onClick: props.onBack }}
      next={{
        label: "🧪 Brew possibilities",
        onClick: props.onBrew,
        disabled: !props.canBrew,
        reason: props.brewBlockedReason,
      }}
    >
      {/* Read-only summary of the cauldron (change it on step 1). */}
      <section className="sticker overflow-hidden bg-lavender-soft">
        {/* Chunky rim across the top of the cauldron box */}
        <div className="flex items-center justify-between border-b-3 border-ink bg-lavender px-5 py-3">
          <h3 className="h-panel">🧪 Your cauldron</h3>
          <span className="rounded-full border-thick border-ink bg-white px-3 text-lg font-semibold">
            {selectedIngredients.length}
          </span>
        </div>
        <div className="p-5">
          {selectedIngredients.length === 0 ? (
            <p className="empty-state">Your cauldron is empty. Go back and tap an ingredient to add it!</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {selectedIngredients.map((ingredient, n) => (
                <li
                  key={ingredient.id}
                  className={`flex items-center gap-1.5 rounded-control border-thick border-ink bg-white px-3 py-1.5 text-base shadow-sticker-sm ${
                    n % 2 === 0 ? "-rotate-2" : "rotate-2"
                  }`}
                >
                  <span aria-hidden="true">{emojiFor(ingredient.name)}</span>
                  {ingredient.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* The Brew button lives in the action bar; pressing Enter in the goal box also brews. */}
      <BrewForm
        goal={props.goal}
        onGoalChange={props.onGoalChange}
        budget={props.budget}
        onBudgetChange={props.onBudgetChange}
        time={props.time}
        onTimeChange={props.onTimeChange}
        brewing={props.brewing}
        onBrew={props.onBrew}
        voice={props.voice}
        showButton={false}
        useEverything={props.useEverything}
        onUseEverythingChange={props.onUseEverythingChange}
      />
    </StepShell>
  );
}
