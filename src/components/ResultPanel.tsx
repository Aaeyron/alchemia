import { BeforeSide } from "@/components/BeforeSide";
import { BrewProgress } from "@/components/BrewProgress";
import { BuildSteps } from "@/components/BuildSteps";
import { IdeaDetails } from "@/components/IdeaDetails";
import { Polaroid } from "@/components/Polaroid";
import { SafetyBox } from "@/components/SafetyBox";
import type { Idea, MaterialInfo } from "@/lib/types";

type ResultPanelProps = {
  idea: Idea;
  beforePhotos: string[]; // all uploaded photos (up to 3)
  materials: MaterialInfo[]; // the idea's materials, with colors where known
  notUsed: string[]; // things in the photos this idea doesn't use
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
    <section className="pop-in sticker flex flex-col gap-5 bg-sky-soft p-5">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <span aria-hidden="true">{idea.emoji}</span>
        {idea.title}
      </h2>

      <div>
        <IdeaDetails idea={idea} />
      </div>

      {/* Stacked on phones, side by side on wider screens */}
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <BeforeSide photos={beforePhotos} materials={materials} notUsed={notUsed} />
        <div className="relative">
          {/* A new key per picture replays the pop-in when a new picture arrives. */}
          <div key={afterImage} className={`pop-in ${painting ? "opacity-60" : ""}`}>
            <Polaroid src={afterImage} alt={`Concept picture of ${idea.title}`} label="After ✨" tilt="rotate-1" />
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
      <p className="-mt-2 text-center text-sm">Concept picture. The real thing may look different.</p>

      {showBuild && idea.buildSteps.length > 0 && (
        <div>
          <h3 className="mb-3 text-xl font-semibold">How to make it</h3>
          <BuildSteps steps={idea.buildSteps} />
        </div>
      )}

      {showBuild && <SafetyBox>{idea.safetyNote}</SafetyBox>}

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="sticker pressable min-h-12 bg-white px-5 py-2 text-lg font-semibold"
        >
          ← Try another idea
        </button>
      )}
    </section>
  );
}
