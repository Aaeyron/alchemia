import { BeforeSide } from "@/components/BeforeSide";
import { BrewProgress } from "@/components/BrewProgress";
import { BuildSteps } from "@/components/BuildSteps";
import { Button } from "@/components/Button";
import { IdeaDetails } from "@/components/IdeaDetails";
import { Polaroid } from "@/components/Polaroid";
import { SafetyBox } from "@/components/SafetyBox";
import { StickerCard } from "@/components/StickerCard";
import type { Idea, MaterialInfo } from "@/lib/types";

type ResultPanelProps = {
  idea: Idea;
  beforePhotos: string[]; // all uploaded photos (up to 3)
  materials: MaterialInfo[]; // the idea's ingredients, with colors where known
  notUsed: string[]; // ingredients in the photos this idea doesn't use
  afterImage: string;
  painting?: boolean; // a new AFTER picture is being made (the old one stays until it's ready)
  showBuild?: boolean; // false = leave out the build steps and safety note (they have their own step)
  onBack?: () => void; // shows a "Try another idea" button when given
};

// Before/after pictures, build steps and the safety note for the chosen idea.
export function ResultPanel({
  idea,
  beforePhotos,
  materials,
  notUsed,
  afterImage,
  painting = false,
  showBuild = true,
  onBack,
}: ResultPanelProps) {
  return (
    <StickerCard tone="sky" emoji={idea.emoji} title={idea.title} className="pop-in">
      <IdeaDetails idea={idea} />

      {/* Stacked on phones, side by side on wider screens. pt-3 leaves room for the tape. */}
      <div className="grid items-start gap-6 pt-3 sm:grid-cols-2">
        <BeforeSide photos={beforePhotos} materials={materials} notUsed={notUsed} />
        <div className="relative">
          {/* A new key per picture replays the pop-in when a new picture arrives. */}
          <div key={afterImage} className={`pop-in ${painting ? "opacity-60" : ""}`}>
            <Polaroid
              src={afterImage}
              alt={`Concept picture of ${idea.title}`}
              label="After ✨"
              tilt="rotate-1"
              tape="tape-pink"
            />
          </div>
          {painting && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="sticker max-w-full bg-white px-4 py-3">
                <BrewProgress kind="paint" compact />
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="caption text-center">Concept picture. The real thing may look different.</p>

      {showBuild && idea.buildSteps.length > 0 && (
        <div>
          <h4 className="h-sub mb-3">🛠️ How to make it</h4>
          <BuildSteps steps={idea.buildSteps} />
        </div>
      )}

      {showBuild && <SafetyBox>{idea.safetyNote}</SafetyBox>}

      {onBack && <Button onClick={onBack}>← Try another idea</Button>}
    </StickerCard>
  );
}
