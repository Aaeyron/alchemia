import { emojiFor } from "@/lib/emoji";
import type { Idea } from "@/lib/types";

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

// Description, materials, time/cost/difficulty and the 3 check badges of an idea.
// Used on the idea cards and in the result panel.
export function IdeaDetails({ idea }: { idea: Idea }) {
  const stars = "★".repeat(idea.difficulty) + "☆".repeat(3 - idea.difficulty);

  return (
    <>
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
    </>
  );
}
