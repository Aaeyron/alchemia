"use client";

import type { RefObject } from "react";
import { BrewProgress } from "@/components/BrewProgress";
import { ErrorBox } from "@/components/ErrorBox";
import { IdeaCard } from "@/components/IdeaCard";
import { StepShell } from "@/components/StepShell";
import type { Idea } from "@/lib/types";

type IdeasStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  bubbling: boolean;
  brewing: boolean;
  brewEmojis: string[]; // the cauldron's ingredients, for the brewing animation
  ideas: Idea[];
  chosen: number | null;
  onChoose: (index: number) => void;
  error: string | null;
  outdated: boolean; // ingredients or goal changed since these ideas were brewed
  canBrew: boolean;
  onBrew: () => void; // "Try again" and "Brew again"
  onShowMe: () => void;
  onBack: () => void; // to step 2
};

// Step 3: the bubbling cauldron, then the 3 idea cards to pick from.
export function IdeasStep(props: IdeasStepProps) {
  const { ideas, chosen, brewing } = props;

  return (
    <StepShell
      emoji="💡"
      title="Ideas"
      instruction="Tap the idea you like best, then see what it could look like."
      say="Pick your favorite!"
      bubbling={props.bubbling}
      headingRef={props.headingRef}
      back={{ label: "← Change my goal", onClick: props.onBack }}
      next={{
        label: "✨ Show me!",
        onClick: props.onShowMe,
        disabled: chosen === null || brewing,
        reason: brewing ? "Wait for the ideas to finish brewing" : "Tap the idea you like first",
      }}
    >
      {props.outdated && !brewing && (
        <div className="sticker flex flex-col gap-3 bg-sunny-soft p-4 text-base">
          <p className="font-medium">Your ingredients or goal changed. Brew again to refresh these ideas.</p>
          <button
            type="button"
            onClick={props.onBrew}
            disabled={!props.canBrew}
            className="sticker pressable min-h-12 self-start bg-pink px-5 py-2 font-bold disabled:pointer-events-none disabled:opacity-50"
          >
            🧪 Brew again
          </button>
        </div>
      )}

      {/* The bubbling cauldron, right where the 3 idea cards will appear. */}
      {brewing && <BrewProgress kind="brew" emojis={props.brewEmojis} />}

      {props.error && <ErrorBox message={props.error} onRetry={props.canBrew ? props.onBrew : undefined} />}

      {/* The cards pop in one after another (100 ms apart). */}
      {ideas.map((idea, i) => (
        <div key={i} className="pop-in" style={{ animationDelay: `${i * 100}ms` }}>
          <IdeaCard idea={idea} index={i} chosen={chosen === i} onChoose={() => props.onChoose(i)} />
        </div>
      ))}
    </StepShell>
  );
}
