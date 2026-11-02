import { BrewProgress } from "@/components/BrewProgress";
import { Button } from "@/components/Button";
import { Polaroid } from "@/components/Polaroid";
import type { StepImageState } from "@/lib/types";

type StepPictureProps = {
  title: string; // the idea's title, for the alt text
  stepNumber: number; // from 1
  isLast: boolean; // the last step shows the concept picture itself
  result: string; // what the project looks like after this step
  simpleGuide: boolean; // the fallback guide has no step pictures
  conceptPicture: string | null;
  state: StepImageState | undefined; // undefined = not started yet (waiting its turn)
  canRetry: boolean;
  onRetry: () => void;
};

// The picture area of one build step. The text below never waits for it.
// Honest results only: a picture that couldn't be painted shows a note, never a stand-in image.
export function StepPicture({
  title,
  stepNumber,
  isLast,
  result,
  simpleGuide,
  conceptPicture,
  state,
  canRetry,
  onRetry,
}: StepPictureProps) {
  const note = (text: string) => <p className="empty-state text-center">{text}</p>;

  if (simpleGuide) return note("Pictures aren't available for the simple guide.");
  if (!conceptPicture) return note("Step pictures need a concept picture. You can paint one in step 4.");

  // Square frame, so the text below doesn't jump when the picture arrives.
  const frame = (children: React.ReactNode) => <div className="mx-auto w-full max-w-72">{children}</div>;

  if (isLast) {
    return frame(
      <Polaroid
        src={conceptPicture}
        alt={`${title}, finished`}
        label="AI concept picture of the finished project"
        tilt="rotate-1"
        tape="tape-pink"
      />
    );
  }

  if (state?.status === "done" && state.image) {
    return frame(
      <Polaroid
        src={state.image}
        alt={`${title} after step ${stepNumber}: ${result}`}
        label="AI picture of how it might look after this step"
        tilt="-rotate-1"
        tape="tape-sunny"
      />
    );
  }

  if (state?.status === "failed") {
    return (
      <div role="status" className="empty-state flex flex-col items-center gap-2 text-center">
        <p>
          <span aria-hidden="true">🎨 </span>
          This step&apos;s picture couldn&apos;t be painted. The steps still work!
        </p>
        {canRetry && <Button onClick={onRetry}>🎨 Try painting this step</Button>}
      </div>
    );
  }

  // Painting, or waiting for a free brush (at most 2 step pictures are painted at a time).
  return frame(
    <div className="sticker flex aspect-square flex-col items-center justify-center gap-2 bg-white p-4">
      {state?.status === "painting" ? (
        <BrewProgress kind="paint" compact modelBadge={`Muse Image is painting step ${stepNumber}`} />
      ) : (
        <p className="hint text-center">Waiting for the brush…</p>
      )}
    </div>
  );
}
