import { SafetyBox } from "@/components/SafetyBox";
import type { Idea } from "@/lib/types";

type ResultPanelProps = {
  idea: Idea;
  beforePhoto: string;
  afterImage: string;
  onBack: () => void;
};

// A polaroid-style frame with a handwritten-ish label underneath.
function Polaroid({ src, alt, label, tilt }: { src: string; alt: string; label: string; tilt: string }) {
  return (
    <figure className={`sticker bg-white p-3 pb-2 ${tilt}`}>
      {/* A plain <img> is fine: the source is a data URL or a temporary API URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="aspect-square w-full rounded-xl object-cover" />
      <figcaption className="mt-2 text-center text-lg font-semibold">{label}</figcaption>
    </figure>
  );
}

// Before/after pictures, build steps and the safety note for the chosen idea.
export function ResultPanel({ idea, beforePhoto, afterImage, onBack }: ResultPanelProps) {
  return (
    <section className="sticker flex flex-col gap-5 bg-sky-soft p-5">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <span aria-hidden="true">{idea.emoji}</span>
        {idea.title}
      </h2>

      {/* Stacked on phones, side by side on wider screens */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Polaroid src={beforePhoto} alt="Your original photo" label="Before" tilt="-rotate-1" />
        <Polaroid src={afterImage} alt={`Concept picture of ${idea.title}`} label="After ✨" tilt="rotate-1" />
      </div>
      <p className="-mt-2 text-center text-sm">Concept picture. The real thing may look different.</p>

      {idea.buildSteps.length > 0 && (
        <div>
          <h3 className="mb-3 text-xl font-semibold">How to make it</h3>
          <ol className="flex flex-col gap-3">
            {idea.buildSteps.map((step, i) => (
              <li key={i} className="sticker flex items-start gap-3 rounded-2xl bg-white p-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-ink bg-sunny text-lg font-bold"
                >
                  {i + 1}
                </span>
                <span className="pt-1 text-base leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <SafetyBox>{idea.safetyNote}</SafetyBox>

      <button
        type="button"
        onClick={onBack}
        className="sticker pressable min-h-12 bg-white px-5 py-2 text-lg font-semibold"
      >
        ← Try another idea
      </button>
    </section>
  );
}
