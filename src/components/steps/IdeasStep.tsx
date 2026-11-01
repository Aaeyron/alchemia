"use client";

import type { RefObject } from "react";
import { BrewProgress } from "@/components/BrewProgress";
import { Button } from "@/components/Button";
import { ErrorBox } from "@/components/ErrorBox";
import { IdeaCard } from "@/components/IdeaCard";
import { StepShell } from "@/components/StepShell";
import type { Idea } from "@/lib/types";

type IdeasStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  say: string; // the mascot's line
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
  useEverything: boolean; // the setting these ideas were brewed with
};

// Step 3: the bubbling cauldron, then the 3 idea cards to pick from.
export function IdeasStep(props: IdeasStepProps) {
  const { ideas, chosen, brewing } = props;

  return (
    <StepShell
      emoji="💡"
      title="Ideas"
      instruction="Tap the idea you like best, then see its concept picture."
      say={props.say}
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
        <div className="panel bg-sunny-soft text-base">
          <p className="font-medium">Your ingredients or goal changed. Brew again to refresh these ideas.</p>
          <Button variant="primary" onClick={props.onBrew} disabled={!props.canBrew} className="self-start">
            🧪 Brew again
          </Button>
        </div>
      )}

      {/* The bubbling cauldron, right where the 3 idea cards will appear. */}
      {brewing && <BrewProgress kind="brew" emojis={props.brewEmojis} />}

      {props.error && <ErrorBox message={props.error} onRetry={props.canBrew ? props.onBrew : undefined} />}

      {/* The cards pop in one after another (100 ms apart). */}
      {ideas.map((idea, i) => (
        <div key={i} className="pop-in" style={{ animationDelay: `${i * 100}ms` }}>
          <IdeaCard
            idea={idea}
            index={i}
            chosen={chosen === i}
            onChoose={() => props.onChoose(i)}
            useEverything={props.useEverything}
          />
        </div>
      ))}
    </StepShell>
  );
}
