"use client";

import type { RefObject } from "react";
import { BrewProgress } from "@/components/BrewProgress";
import { ErrorBox } from "@/components/ErrorBox";
import { ResultPanel } from "@/components/ResultPanel";
import { StepShell } from "@/components/StepShell";
import { TweakPanel, type TweakKind } from "@/components/TweakPanel";
import type { Idea, MaterialInfo } from "@/lib/types";

type SeeItStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  resultRef: RefObject<HTMLDivElement | null>; // the page scrolls here when a new picture or tweak arrives
  bubbling: boolean;
  idea: Idea | null; // the shown idea (latest tweak, or the chosen card)
  beforePhotos: string[];
  materials: MaterialInfo[];
  notUsed: string[];
  conceptImage: string | null;
  visualizing: boolean;
  visualizeError: string | null;
  onRetryPicture: () => void;
  tweaking: boolean;
  tweakError: string | null;
  onTweak: (kind: TweakKind, missing?: string[]) => void;
  onRetryTweak: () => void;
  canGoBack: boolean;
  onBackToPrevious: () => void;
  voice: React.ReactNode;
  onTryAnother: () => void; // to step 3
  onBuild: () => void; // to step 5
};

// Step 4: before/after picture, and tweaks.
export function SeeItStep({
  headingRef,
  resultRef,
  bubbling,
  idea,
  beforePhotos,
  materials,
  notUsed,
  conceptImage,
  visualizing,
  visualizeError,
  onRetryPicture,
  tweaking,
  tweakError,
  onTweak,
  onRetryTweak,
  canGoBack,
  onBackToPrevious,
  voice,
  onTryAnother,
  onBuild,
}: SeeItStepProps) {
  const working = visualizing || tweaking;

  return (
    <StepShell
      emoji="✨"
      title="See it"
      instruction="Here's what your invention could look like. Tweak it until you love it!"
      say="Ta-da! Want to change anything?"
      bubbling={bubbling}
      headingRef={headingRef}
      back={{
        label: "← Try another idea",
        onClick: onTryAnother,
        disabled: working,
        reason: "Wait for Alchemia to finish first",
      }}
      next={{ label: "🛠️ How do I build it?", onClick: onBuild, disabled: idea === null }}
      nextColor="bg-mint"
    >
      <div ref={resultRef} className="flex scroll-mt-6 flex-col gap-6">
        {idea && conceptImage ? (
          <>
            <ResultPanel
              idea={idea}
              beforePhotos={beforePhotos}
              materials={materials}
              notUsed={notUsed}
              afterImage={conceptImage}
              painting={visualizing}
              showBuild={false}
            />
            <TweakPanel
              materials={idea.materialsUsed}
              busy={working}
              tweaking={tweaking}
              onTweak={onTweak}
              canGoBack={canGoBack}
              onBackToPrevious={onBackToPrevious}
              error={tweakError}
              onRetry={onRetryTweak}
              voice={voice}
            />
          </>
        ) : (
          idea && (
            // First picture still on its way (or it failed): show which idea it is.
            <p className="sticker flex items-center gap-2 bg-sky-soft p-4 text-2xl font-semibold">
              <span aria-hidden="true">{idea.emoji}</span>
              {idea.title}
            </p>
          )
        )}

        {/* First picture: the painting animation. (Later pictures show it inside the AFTER frame.) */}
        {visualizing && !conceptImage && <BrewProgress kind="paint" />}

        {visualizeError && <ErrorBox message={visualizeError} onRetry={onRetryPicture} />}
      </div>
    </StepShell>
  );
}
