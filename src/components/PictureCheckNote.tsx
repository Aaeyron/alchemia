import { BrewProgress } from "@/components/BrewProgress";
import { Button } from "@/components/Button";
import type { PictureCheck } from "@/lib/types";

// Where the background picture check is at (null = no check for the picture on screen).
export type PictureCheckState =
  | { status: "checking" }
  | { status: "done"; result: PictureCheck }
  | { status: "error" };

type PictureCheckNoteProps = {
  check: PictureCheckState | null;
  canRepaint: boolean; // false after 2 repaints of this idea
  busy: boolean; // a picture or tweak is being made
  onRepaint: () => void;
};

// Under the AFTER picture: does the concept picture match the recipe? (An AI check, so it's honest about it.)
export function PictureCheckNote({ check, canRepaint, busy, onRepaint }: PictureCheckNoteProps) {
  if (!check) return null;

  if (check.status === "checking") {
    return (
      <div className="flex justify-center">
        <BrewProgress kind="check" compact />
      </div>
    );
  }

  if (check.status === "error") {
    return <p className="hint text-center">Couldn&apos;t double-check this picture.</p>;
  }

  const { missing, extras } = check.result;
  if (missing.length === 0 && extras.length === 0) {
    return <p className="stamp -rotate-1 self-center">✓ Picture matches your recipe</p>;
  }

  const parts = [
    extras.length > 0 ? `it shows ${extras.join(", ")}` : null,
    missing.length > 0 ? `it doesn't clearly show ${missing.join(", ")}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="stamp stamp-fail normal-case">⚠ Picture may differ: {parts.join(" / ")}</p>
      <p className="hint">AI check. It can miss things.</p>
      {canRepaint && (
        <Button onClick={onRepaint} disabled={busy}>
          🔁 Repaint
        </Button>
      )}
    </div>
  );
}
