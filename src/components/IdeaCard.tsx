import { Button } from "@/components/Button";
import { IdeaDetails } from "@/components/IdeaDetails";
import { SafetyBox } from "@/components/SafetyBox";
import { StickerCard } from "@/components/StickerCard";
import type { Idea } from "@/lib/types";

type IdeaCardProps = {
  idea: Idea;
  index: number;
  chosen: boolean;
  onChoose: () => void;
  useEverything: boolean; // the brew-time setting: makes "uses N of M" a real check
};

// One invention idea, written on a notebook page. Tapping anywhere on it picks it.
export function IdeaCard({ idea, index, chosen, onChoose, useEverything }: IdeaCardProps) {
  return (
    // Clicks on the inner button bubble up here, so the whole card is tappable.
    <div
      onClick={onChoose}
      className={`cursor-pointer rounded-[1.75rem] ${chosen ? "outline-4 outline-offset-4 outline-pink" : ""}`}
    >
      <StickerCard as="article" tone="paper" index={index} emoji={idea.emoji} title={idea.title}>
        <IdeaDetails idea={idea} useEverything={useEverything} />

        <SafetyBox>{idea.safetyNote}</SafetyBox>

        <Button variant={chosen ? "primary" : "secondary"} aria-pressed={chosen} className="w-full">
          {chosen ? "✓ Chosen!" : "Pick this idea"}
        </Button>
      </StickerCard>
    </div>
  );
}
