import { SafetyBox } from "@/components/SafetyBox";
import { StickerCard } from "@/components/StickerCard";
import { emojiFor } from "@/lib/emoji";
import type { Idea } from "@/lib/types";

type IdeaCardProps = {
  idea: Idea;
  index: number;
  chosen: boolean;
  onChoose: () => void;
};

// A small pass/fail badge for one of the server's checks.
function CheckBadge({ passed, pass, fail }: { passed: boolean; pass: string; fail: string }) {
  return (
    <span
      className={`rounded-full border-2 px-2.5 py-0.5 text-sm font-semibold ${
        passed ? "border-ink bg-white" : "border-red-700 bg-red-100 text-red-800"
      }`}
    >
      {passed ? `✓ ${pass}` : `✗ ${fail}`}
    </span>
  );
}

// One invention idea, shown on a StickerCard. Tapping anywhere on it picks it.
export function IdeaCard({ idea, index, chosen, onChoose }: IdeaCardProps) {
  const stars = "★".repeat(idea.difficulty) + "☆".repeat(3 - idea.difficulty);

  return (
    // Clicks on the inner button bubble up here, so the whole card is tappable.
    <div
      onClick={onChoose}
      className={`cursor-pointer rounded-[1.75rem] ${
        chosen ? "outline-4 outline-offset-4 outline-pink" : ""
      }`}
    >
      <StickerCard index={index} emoji={idea.emoji} title={idea.title}>
        <p className="mb-3">{idea.description}</p>

        {/* Materials as little stickers */}
        <ul className="mb-3 flex flex-wrap gap-2">
          {idea.materialsUsed.map((material, i) => (
            <li key={i} className="flex items-center gap-1 rounded-xl border-2 border-ink bg-white px-2 py-0.5 text-sm">
              <span aria-hidden="true">{emojiFor(material)}</span>
              {material}
            </li>
          ))}
        </ul>

        <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 font-medium">
          <span>⏱️ {idea.timeMinutes} min</span>
          <span>🪙 {idea.costPhp === 0 ? "Free!" : `₱${idea.costPhp}`}</span>
          <span aria-label={`Difficulty ${idea.difficulty} of 3`}>
            <span aria-hidden="true">{stars}</span>
          </span>
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <CheckBadge passed={idea.checks.materials} pass="your materials only" fail="needs other stuff" />
          <CheckBadge passed={idea.checks.budget} pass="within budget" fail="over budget" />
          <CheckBadge passed={idea.checks.time} pass="within time" fail="takes too long" />
        </div>

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
