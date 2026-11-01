"use client";

import type { RefObject } from "react";
import { BuildSteps } from "@/components/BuildSteps";
import { SafetyBox } from "@/components/SafetyBox";
import { StepShell } from "@/components/StepShell";
import type { Idea } from "@/lib/types";

type BuildStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  bubbling: boolean;
  idea: Idea | null; // the CURRENT idea (including tweaks)
  canStartNew: boolean;
  onBack: () => void; // to step 4
  onStartNew: () => void;
};

// Step 5: how to build the current idea, step by step, and how to stay safe.
export function BuildStep({ headingRef, bubbling, idea, canStartNew, onBack, onStartNew }: BuildStepProps) {
  return (
    <StepShell
      emoji="🛠️"
      title="Build"
      instruction="Follow the steps one by one. Ask a grown-up if you need help!"
      say="Let's build it!"
      bubbling={bubbling}
      headingRef={headingRef}
      back={{ label: "← Back to the picture", onClick: onBack }}
      next={{
        label: "🔄 Start a new invention",
        onClick: onStartNew,
        disabled: !canStartNew,
        reason: "Wait for Alchemia to finish first",
      }}
      nextColor="bg-sky"
    >
      {idea && (
        <>
          {/* Small summary: title, time and cost */}
          <section className="sticker flex flex-col gap-2 bg-sky-soft p-5">
            <h3 className="flex items-center gap-2 text-2xl font-semibold">
              <span aria-hidden="true">{idea.emoji}</span>
              {idea.title}
            </h3>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-lg font-medium">
              <span>⏱️ {idea.timeMinutes} min</span>
              <span>🪙 {idea.costPhp === 0 ? "Free!" : `₱${idea.costPhp}`}</span>
            </p>
          </section>

          {idea.buildSteps.length > 0 && (
            <section>
              <h3 className="mb-3 text-2xl font-semibold">How to make it</h3>
              <BuildSteps steps={idea.buildSteps} />
            </section>
          )}

          <SafetyBox>{idea.safetyNote}</SafetyBox>
        </>
      )}
    </StepShell>
  );
}
