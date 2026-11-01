"use client";

import type { RefObject } from "react";
import { BrewProgress } from "@/components/BrewProgress";
import { ErrorBox } from "@/components/ErrorBox";
import { PictureCheckNote, type PictureCheckState } from "@/components/PictureCheckNote";
import { RecipeCard } from "@/components/RecipeCard";
import { ResultPanel } from "@/components/ResultPanel";
import { StepShell } from "@/components/StepShell";
import { StickerCard } from "@/components/StickerCard";
import { TweakPanel, type TweakKind } from "@/components/TweakPanel";
import type { Idea, Ingredient, MaterialInfo } from "@/lib/types";

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
  ingredients: Ingredient[]; // the shared list, for colors in the recipe
  useEverything: boolean; // the brew-time setting
  pictureCheck: PictureCheckState | null;
  canRepaint: boolean;
  onRepaint: () => void;
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
  ingredients,
  useEverything,
  pictureCheck,
  canRepaint,
  onRepaint,
}: SeeItStepProps) {
  const working = visualizing || tweaking;

  return (
    <StepShell
      emoji="✨"
      title="See it"
      instruction="Here's the concept picture of your idea. Tweak it until you love it!"
      say="Ta-da! Want to change anything?"
      bubbling={bubbling}
      headingRef={headingRef}
      back={{
        label: "← Try another idea",
        onClick: onTryAnother,
        disabled: working,
        reason: "Wait for Alchemia to finish first",
      }}
      next={{
        label: "🛠️ How do I build it?",
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
              afterNote={
                <PictureCheckNote check={pictureCheck} canRepaint={canRepaint} busy={working} onRepaint={onRepaint} />
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
          // First concept picture still on its way (or it failed): show which idea it is.
          <StickerCard tone="sky" emoji={idea.emoji} title={idea.title}>
            <p className="text-base">{idea.description}</p>
          </StickerCard>
        ) : (
          <p className="empty-state">No idea picked yet. Go back to step 3 and pick one!</p>
        )}

        {/* First picture: the painting animation. (Later pictures show it inside the AFTER frame.) */}
        {visualizing && !conceptImage && <BrewProgress kind="paint" />}

        {visualizeError && <ErrorBox message={visualizeError} onRetry={onRetryPicture} />}
      </div>
    </StepShell>
  );
}
