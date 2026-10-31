import { IdeaDetails } from "@/components/IdeaDetails";
import { SafetyBox } from "@/components/SafetyBox";
import { StickerCard } from "@/components/StickerCard";
import type { Idea } from "@/lib/types";

type IdeaCardProps = {
  idea: Idea;
  index: number;
  chosen: boolean;
  onChoose: () => void;
};

// One invention idea, shown on a StickerCard. Tapping anywhere on it picks it.
export function IdeaCard({ idea, index, chosen, onChoose }: IdeaCardProps) {
  return (
    // Clicks on the inner button bubble up here, so the whole card is tappable.
    <div
      onClick={onChoose}
      className={`cursor-pointer rounded-[1.75rem] ${
        chosen ? "outline-4 outline-offset-4 outline-pink" : ""
      }`}
    >
      <StickerCard index={index} emoji={idea.emoji} title={idea.title}>
        <IdeaDetails idea={idea} />

        <SafetyBox>{idea.safetyNote}</SafetyBox>

        <button
          type="button"
          aria-pressed={chosen}
          className={`sticker pressable mt-4 min-h-12 w-full px-4 py-2 text-lg font-semibold ${
            chosen ? "bg-pink" : "bg-white"
          }`}
        >
          {chosen ? "✓ Chosen!" : "Pick this one"}
        </button>
      </StickerCard>
    </div>
  );
}
