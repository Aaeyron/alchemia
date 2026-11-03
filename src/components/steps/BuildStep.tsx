"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { BrewProgress } from "@/components/BrewProgress";
import { BuildMode } from "@/components/BuildMode";
import { BuildPreview } from "@/components/BuildPreview";
import { BuildSteps } from "@/components/BuildSteps";
import { Button } from "@/components/Button";
import { PaperClip, Pencil } from "@/components/Doodles";
import { ErrorBox } from "@/components/ErrorBox";
import { RecipeCard } from "@/components/RecipeCard";
import { SafetyBox } from "@/components/SafetyBox";
import { StepShell } from "@/components/StepShell";
import { StepPicture } from "@/components/StepPicture";
import { StickerCard } from "@/components/StickerCard";
import { UsageStamp } from "@/components/UsageStamp";
import { pickLine } from "@/lib/bubbleLines";
import type { BuildState, Idea, Ingredient } from "@/lib/types";

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
  // Build Mode (for the current version of the idea)
  build: BuildState | null; // null = not started for this version
  guideLoading: boolean;
  guideError: string | null;
  canStartBuild: boolean;
  startBuildReason: string; // why "Start Build Mode" is disabled
  onStartBuild: () => void; // fetch the guide (shows the preview)
  onBeginSteps: () => void; // "Let's build it!"
  onStepDone: () => void;
  onStepBack: () => void;
  onJumpToStep: (index: number) => void;
  canRetryStepPicture: boolean; // tries left for the picture of the step on screen
  onRetryStepPicture: () => void;
};

// "Project ready ✓": a rubber stamp that thumps down (no motion for reduced-motion users).
// Bubbles cheers once when it scrolls into view.
function ReadyStamp({ onSeen }: { onSeen: () => void }) {
  const stamp = useRef<HTMLParagraphElement>(null);
  const seen = useRef(onSeen);
  useEffect(() => {
    seen.current = onSeen;
  });

  useEffect(() => {
    const element = stamp.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        seen.current();
        observer.disconnect(); // once per stamp
      },
      { threshold: 0.6 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex justify-center py-2">
      <p ref={stamp} className="rubber-stamp">
        Project ready ✓
      </p>
    </div>
  );
}

// Step 5: how to build the current idea, and how to stay safe.
// Before Build Mode: the short steps. In Build Mode: the preview, then one step at a time.
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
  build,
  guideLoading,
  guideError,
  canStartBuild,
  startBuildReason,
  onStartBuild,
  onBeginSteps,
  onStepDone,
  onStepBack,
  onJumpToStep,
  canRetryStepPicture,
  onRetryStepPicture,
}: BuildStepProps) {
  // When a "Project ready ✓" stamp scrolls into view, Bubbles cheers once.
  const [cheerLine, setCheerLine] = useState<string | null>(null);
  const cheer = (kind: "done" | "build-done") => setCheerLine(pickLine({ kind }, null));
  const finished = build !== null && build.done[build.done.length - 1] === true;

  function buildArea() {
    if (!idea) return null;
    if (guideLoading) return <BrewProgress kind="guide" />;

    if (build && !build.started) {
      return (
        <BuildPreview
          title={idea.title}
          guide={build.guide}
          picture={build.picture}
          ingredients={ingredients}
          onStart={onBeginSteps}
        />
      );
    }

    if (build) {
      return (
        <>
          <BuildMode
            guide={build.guide}
            current={build.current}
            done={build.done}
            ingredients={ingredients}
            picture={
              <StepPicture
                title={idea.title}
                stepNumber={build.current + 1}
                isLast={build.current === build.guide.steps.length - 1}
                result={build.guide.steps[build.current].result}
                simpleGuide={build.guide.fallback}
                conceptPicture={build.picture}
                state={build.stepImages[build.current]}
                canRetry={canRetryStepPicture}
                onRetry={onRetryStepPicture}
              />
            }
            onDone={onStepDone}
            onBack={onStepBack}
            onJump={onJumpToStep}
          />
          {finished && <ReadyStamp onSeen={() => cheer("build-done")} />}
        </>
      );
    }

    // Not in Build Mode yet: the start button, then the short steps and safety note as before.
    return (
      <>
        <StickerCard tone="mint" emoji="🛠️" title="Build Mode">
          <p className="text-base">One step at a time, with everything you need. Muse Spark writes the guide.</p>
          <Button
            variant="primary"
            size="large"
            onClick={onStartBuild}
            disabled={!canStartBuild}
            aria-describedby={!canStartBuild ? "build-reason" : undefined}
          >
            🛠️ Start Build Mode
          </Button>
          {!canStartBuild && (
            <p id="build-reason" className="hint">
              {startBuildReason}
            </p>
          )}
        </StickerCard>
        {guideError && <ErrorBox message={guideError} onRetry={canStartBuild ? onStartBuild : undefined} />}

        {idea.buildSteps.length > 0 && (
          <StickerCard tone="paper" emoji="🛠️" title="How to make it">
            <BuildSteps steps={idea.buildSteps} />
            <Pencil className="h-4 w-16 self-end -rotate-6" />
          </StickerCard>
        )}

        <SafetyBox>{idea.safetyNote}</SafetyBox>

        <ReadyStamp onSeen={() => cheer("done")} />
      </>
    );
  }

  return (
    <StepShell
      emoji="🛠️"
      title="Build"
      instruction="Follow the steps one by one. Ask a grown-up if you need help!"
      say={cheerLine ?? say}
      cheer={cheerLine !== null}
      bubbling={bubbling}
      headingRef={headingRef}
      back={{ label: "← Back to the picture", short: "← Back", onClick: onBack }}
      next={{
        label: "🔄 Start a new invention",
        short: "🔄 Start over",
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

          {buildArea()}
        </>
      ) : (
        <p className="empty-state">No idea picked yet. Go back to step 3 and pick one!</p>
      )}
    </StepShell>
  );
}
