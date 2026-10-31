"use client";

import { useState } from "react";
import { BrewProgress } from "@/components/BrewProgress";
import { Chip } from "@/components/Chip";
import { ErrorBox } from "@/components/ErrorBox";
import { emojiFor } from "@/lib/emoji";

export type TweakKind = "missing" | "weird" | "easier";

type TweakPanelProps = {
  materials: string[]; // the current idea's materials, for "I don't have…"
  busy: boolean; // a tweak or a picture is in progress
  tweaking: boolean;
  onTweak: (kind: TweakKind, missing?: string[]) => void;
  canGoBack: boolean;
  onBackToPrevious: () => void;
  error: string | null;
  onRetry: () => void;
  voice?: React.ReactNode; // optional mic button, shown under the tweak buttons
};

const buttonClass =
  "sticker pressable min-h-14 bg-white px-4 py-2 text-lg font-semibold disabled:pointer-events-none disabled:opacity-50";

// "Tweak it!" — change the chosen idea without starting over.
export function TweakPanel({
  materials,
  busy,
  tweaking,
  onTweak,
  canGoBack,
  onBackToPrevious,
  error,
  onRetry,
  voice,
}: TweakPanelProps) {
  const [pickingMissing, setPickingMissing] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  function toggleMissing(material: string) {
    setMissing((current) =>
      current.includes(material) ? current.filter((m) => m !== material) : [...current, material]
    );
  }

  function redesign() {
    onTweak("missing", missing);
    setPickingMissing(false);
    setMissing([]);
  }

  return (
    <section className="sticker flex flex-col gap-4 bg-sunny-soft p-5">
      <div>
        <h2 className="text-2xl font-semibold">🔧 Tweak it!</h2>
        <p className="text-base">Change your idea without starting over.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          disabled={busy}
          aria-expanded={pickingMissing}
          onClick={() => setPickingMissing((open) => !open)}
          className={buttonClass}
        >
          🚫 I don&apos;t have…
        </button>
        <button type="button" disabled={busy} onClick={() => onTweak("weird")} className={buttonClass}>
          🌀 Make it weird
        </button>
        <button type="button" disabled={busy} onClick={() => onTweak("easier")} className={buttonClass}>
          🪄 Make it easier
        </button>
      </div>

      {voice}

      {pickingMissing && (
        <div className="flex flex-col gap-3">
          <p className="text-base font-medium">Tap the things you don&apos;t have:</p>
          <div className="flex flex-wrap gap-3">
            {materials.map((material) => (
              <Chip
                key={material}
                emoji={emojiFor(material)}
                label={material}
                selected={missing.includes(material)}
                onToggle={() => toggleMissing(material)}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={busy || missing.length === 0}
            onClick={redesign}
            className="sticker pressable min-h-12 self-start bg-pink px-5 py-2 text-lg font-bold disabled:pointer-events-none disabled:opacity-50"
          >
            Redesign
          </button>
        </div>
      )}

      {tweaking && <BrewProgress kind="tweak" />}

      {error && <ErrorBox message={error} onRetry={onRetry} />}

      {canGoBack && (
        <button
          type="button"
          onClick={onBackToPrevious}
          className="sticker pressable min-h-11 self-start bg-white px-4 py-1.5 text-base font-medium"
        >
          ↩ Back to previous version
        </button>
      )}
    </section>
  );
}
