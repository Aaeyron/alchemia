import { UsageStamp } from "@/components/UsageStamp";
import { emojiFor } from "@/lib/emoji";
import type { Idea } from "@/lib/types";

// An ink stamp for one of the server's checks: blue and crooked when it passes,
// red, dashed and straight when it fails (styles: .stamp in globals.css).
function CheckStamp({ passed, pass, fail, tilt }: { passed: boolean; pass: string; fail: string; tilt: string }) {
  return (
    <span className={passed ? `stamp ${tilt}` : "stamp stamp-fail"}>
      {passed ? `✓ ${pass}` : `✗ ${fail}`}
    </span>
  );
}

// Description, ingredients, time/cost/difficulty, the check stamps and what's left in the cauldron.
// Used on the idea cards and in the result panel.
export function IdeaDetails({ idea, useEverything = false }: { idea: Idea; useEverything?: boolean }) {
  const stars = "★".repeat(idea.difficulty) + "☆".repeat(3 - idea.difficulty);

  return (
    <div className="flex flex-col gap-3 text-base leading-relaxed">
      <p>{idea.description}</p>

      {/* Ingredients as little stickers */}
      <ul aria-label="Ingredients" className="flex flex-wrap gap-2">
        {idea.materialsUsed.map((material, i) => (
          <li key={i} className="flex items-center gap-1 rounded-control border-thin border-ink bg-white px-2 py-0.5 text-sm">
            <span aria-hidden="true">{emojiFor(material)}</span>
            {material}
          </li>
        ))}
      </ul>

      <p className="flex flex-wrap gap-x-4 gap-y-1 font-medium">
        <span>⏱️ {idea.timeMinutes} min</span>
        <span>🪙 {idea.costPhp === 0 ? "Free!" : `₱${idea.costPhp}`}</span>
        <span aria-label={`Difficulty ${idea.difficulty} of 3`}>
          <span aria-hidden="true">{stars}</span>
        </span>
      </p>

      <div className="flex flex-wrap gap-2">
        <CheckStamp passed={idea.checks.materials} pass="your ingredients only" fail="needs more ingredients" tilt="-rotate-2" />
        <CheckStamp passed={idea.checks.budget} pass="within budget" fail="over budget" tilt="rotate-1" />
        <CheckStamp passed={idea.checks.time} pass="within time" fail="takes too long" tilt="-rotate-1" />
        <UsageStamp idea={idea} useEverything={useEverything} />
      </div>

      {/* Which cauldron ingredients this idea leaves out, and why. Clicks here don't pick the card. */}
      {idea.skipped.length > 0 && (
        <details className="text-sm" onClick={(event) => event.stopPropagation()}>
          <summary className="cursor-pointer py-2 font-medium">
            Left in the cauldron ({idea.skipped.length})
          </summary>
          <ul className="flex flex-col gap-1 pl-4">
            {idea.skipped.map(({ ingredient, reason }) => (
              <li key={ingredient}>
                <span aria-hidden="true">{emojiFor(ingredient)} </span>
                <strong>{ingredient}</strong>: {reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
