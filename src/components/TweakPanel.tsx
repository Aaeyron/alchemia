"use client";

import { useState } from "react";
import { BrewProgress } from "@/components/BrewProgress";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { ErrorBox } from "@/components/ErrorBox";
import { StickerCard } from "@/components/StickerCard";
import { emojiFor } from "@/lib/emoji";

export type TweakKind = "missing" | "weird" | "easier";

type TweakPanelProps = {
  materials: string[]; // the current idea's ingredients, for "I don't have…"
  busy: boolean; // a tweak or a picture is in progress
  tweaking: boolean;
  onTweak: (kind: TweakKind, missing?: string[]) => void;
  canGoBack: boolean;
  onBackToPrevious: () => void;
  error: string | null;
  onRetry: () => void;
  voice?: React.ReactNode; // optional mic button, shown under the tweak buttons
};

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
    <StickerCard tone="sunny" emoji="🪄" title="Tweak it!">
      <p className="-mt-2 text-base">Change your idea without starting over.</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Button disabled={busy} aria-expanded={pickingMissing} onClick={() => setPickingMissing((open) => !open)}>
          🚫 I don&apos;t have…
        </Button>
        <Button disabled={busy} onClick={() => onTweak("weird")}>
          🌀 Make it weird
        </Button>
        <Button disabled={busy} onClick={() => onTweak("easier")}>
          🌱 Make it easier
        </Button>
      </div>

      {voice}

      {pickingMissing && (
        <div className="flex flex-col gap-3">
          <p className="text-base font-medium">Tap the ingredients you don&apos;t have:</p>
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
          <Button variant="primary" disabled={busy || missing.length === 0} onClick={redesign} className="self-start">
            Redesign without them
          </Button>
        </div>
      )}

      {tweaking && <BrewProgress kind="tweak" />}

      {error && <ErrorBox message={error} onRetry={onRetry} />}

      {canGoBack && (
        <Button variant="ghost" onClick={onBackToPrevious} className="self-start">
          ↩ Back to previous version
        </Button>
      )}
    </StickerCard>
  );
}
