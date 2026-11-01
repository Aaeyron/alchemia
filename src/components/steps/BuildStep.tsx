"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { BuildSteps } from "@/components/BuildSteps";
import { PaperClip, Pencil } from "@/components/Doodles";
import { RecipeCard } from "@/components/RecipeCard";
import { SafetyBox } from "@/components/SafetyBox";
import { StepShell } from "@/components/StepShell";
import { StickerCard } from "@/components/StickerCard";
import { UsageStamp } from "@/components/UsageStamp";
import { pickLine } from "@/lib/bubbleLines";
import type { Idea, Ingredient } from "@/lib/types";

type BuildStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  bubbling: boolean;
  idea: Idea | null; // the CURRENT idea (including tweaks)
  ingredients: Ingredient[]; // the shared list, for colors in the recipe
  useEverything: boolean; // the brew-time setting
  canStartNew: boolean;
  onBack: () => void; // to step 4
  onStartNew: () => void;
  say: string; // the mascot's line (until it cheers)
};

// Step 5: how to build the current idea, step by step, and how to stay safe.
export function BuildStep({
  headingRef,
  bubbling,
  idea,
  ingredients,
  useEverything,
  canStartNew,
  onBack,
  onStartNew,
  say,
}: BuildStepProps) {
  // When the "Project ready ✓" stamp scrolls into view, Bubbles cheers once with a "done" line.
  const stamp = useRef<HTMLParagraphElement>(null);
  const [cheerLine, setCheerLine] = useState<string | null>(null);
  const hasIdea = idea !== null; // the stamp only exists when there's an idea

  useEffect(() => {
    const element = stamp.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setCheerLine(pickLine({ kind: "done" }, null));
        observer.disconnect(); // once per visit to this step
      },
      { threshold: 0.6 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasIdea]);

  return (
    <StepShell
      emoji="🛠️"
      title="Build"
      instruction="Follow the steps one by one. Ask a grown-up if you need help!"
      say={cheerLine ?? say}
      cheer={cheerLine !== null}
      bubbling={bubbling}
      headingRef={headingRef}
      back={{ label: "← Back to the picture", onClick: onBack }}
      next={{
        label: "🔄 Start a new invention",
        onClick: onStartNew,
        disabled: !canStartNew,
        reason: "Wait for Alchemia to finish first",
      }}
    >
      {idea ? (
        <>
          {/* Small summary: title, time and cost, clipped on with a paper clip */}
          <div className="relative">
            <PaperClip className="absolute -top-4 right-6 z-10 h-14 w-6 rotate-6" />
            <StickerCard tone="sky" emoji={idea.emoji} title={idea.title}>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-lg font-medium">
                <span>⏱️ {idea.timeMinutes} min</span>
                <span>🪙 {idea.costPhp === 0 ? "Free!" : `₱${idea.costPhp}`}</span>
              </p>
              <UsageStamp idea={idea} useEverything={useEverything} />
            </StickerCard>
          </div>

          <RecipeCard idea={idea} ingredients={ingredients} useEverything={useEverything} />

          {idea.buildSteps.length > 0 && (
            <StickerCard tone="paper" emoji="🛠️" title="How to make it">
              <BuildSteps steps={idea.buildSteps} />
              <Pencil className="h-4 w-16 self-end -rotate-6" />
            </StickerCard>
          )}

          <SafetyBox>{idea.safetyNote}</SafetyBox>

          {/* Rubber stamp that thumps down when this step opens (no motion for reduced-motion users). */}
          <div className="flex justify-center py-2">
            <p ref={stamp} className="rubber-stamp">
              Project ready ✓
            </p>
          </div>
        </>
      ) : (
        <p className="empty-state">No idea picked yet. Go back to step 3 and pick one!</p>
      )}
    </StepShell>
  );
}
