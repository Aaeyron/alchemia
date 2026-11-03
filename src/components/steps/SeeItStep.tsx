"use client";

import type { RefObject } from "react";
import { BrewProgress } from "@/components/BrewProgress";
import { PictureCheckNote, type PictureCheckState } from "@/components/PictureCheckNote";
import { PictureError } from "@/components/PictureError";
import { RecipeCard } from "@/components/RecipeCard";
import { ResultPanel } from "@/components/ResultPanel";
import { StepShell } from "@/components/StepShell";
import { StickerCard } from "@/components/StickerCard";
import { TweakPanel, type TweakKind } from "@/components/TweakPanel";
import type { Idea, Ingredient, MaterialInfo } from "@/lib/types";

type SeeItStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  say: string; // the mascot's line
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
  ingredients: Ingredient[]; // the shared list, for colors in the recipe
  useEverything: boolean; // the brew-time setting
  pictureCheck: PictureCheckState | null;
  canRepaint: boolean;
  onRepaint: () => void;
  pictureOutdated: boolean; // the picture on screen belongs to the previous version (a tweak's picture failed or is coming)
};

// Step 4: before/after picture, and tweaks.
export function SeeItStep({
  headingRef,
  say,
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
  ingredients,
  useEverything,
  pictureCheck,
  canRepaint,
  onRepaint,
  pictureOutdated,
}: SeeItStepProps) {
  const working = visualizing || tweaking;

  return (
    <StepShell
      emoji="✨"
      title="See it"
      instruction="Here's the concept picture of your idea. Tweak it until you love it!"
      say={say}
      bubbling={bubbling}
      headingRef={headingRef}
      back={{
        label: "← Try another idea",
        short: "← Ideas",
        onClick: onTryAnother,
        disabled: working,
        reason: "Wait for Alchemia to finish first",
      }}
      next={{
        label: "🛠️ How do I build it?",
        short: "🛠️ Build it",
        onClick: onBuild,
        disabled: idea === null,
        reason: "Pick an idea first",
      }}
    >
      <div ref={resultRef} className="flex scroll-mt-6 flex-col gap-section">
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
              useEverything={useEverything}
              pictureOutdated={pictureOutdated}
              afterNote={
                // Painting failed: only the picture area says so. Otherwise the picture check
                // (not for an old picture: it was checked against the previous version).
                visualizeError ? (
                  <PictureError message={visualizeError} busy={working} onRetry={onRetryPicture} />
                ) : (
                  !pictureOutdated && (
                    <PictureCheckNote check={pictureCheck} canRepaint={canRepaint} busy={working} onRepaint={onRepaint} />
                  )
                )
              }
            />
            <RecipeCard idea={idea} ingredients={ingredients} useEverything={useEverything} />
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
        ) : idea ? (
          // First concept picture still on its way (or it failed): the idea and its recipe stay,
          // and only the picture area shows the painting animation or the error.
          <>
            <StickerCard tone="sky" emoji={idea.emoji} title={idea.title}>
              <p className="text-base">{idea.description}</p>
              {visualizing && <BrewProgress kind="paint" />}
              {visualizeError && <PictureError message={visualizeError} busy={working} onRetry={onRetryPicture} />}
            </StickerCard>
            <RecipeCard idea={idea} ingredients={ingredients} useEverything={useEverything} />
          </>
        ) : (
          <p className="empty-state">No idea picked yet. Go back to step 3 and pick one!</p>
        )}
      </div>
    </StepShell>
  );
}
