import { StickerCard } from "@/components/StickerCard";
import { UsageStamp } from "@/components/UsageStamp";
import { emojiFor } from "@/lib/emoji";
import { matchIngredient } from "@/lib/ingredients";
import type { Idea, Ingredient } from "@/lib/types";

type RecipeCardProps = {
  idea: Idea;
  ingredients: Ingredient[]; // the shared ingredient list, for colors
  useEverything: boolean;
};

// The recipe on a notebook page: each cauldron ingredient → what it becomes,
// and the ones left in the cauldron, faded, with the reason.
export function RecipeCard({ idea, ingredients, useEverything }: RecipeCardProps) {
  return (
    <StickerCard tone="paper" emoji="📝" title="Your recipe">
      <UsageStamp idea={idea} useEverything={useEverything} />

      <ul className="flex flex-col gap-3" aria-label="Ingredients and what they become">
        {idea.roles.map(({ ingredient, role }) => {
          const color = matchIngredient(ingredients, ingredient)?.color;
          return (
            <li key={ingredient} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
              <span className="flex items-center gap-1 rounded-control border-thin border-ink bg-white px-2 py-0.5 shadow-sticker-sm">
                <span aria-hidden="true">{emojiFor(ingredient)}</span>
                {ingredient}
                {color && <span className="text-sm text-ink-soft">· {color}</span>}
              </span>
              <span className="font-medium">
                <span aria-hidden="true">→ </span>
                <span className="sr-only">becomes </span>
                {role}
              </span>
            </li>
          );
        })}
      </ul>

      {idea.skipped.length > 0 && (
        <div>
          <h4 className="h-sub mb-2">Left in the cauldron</h4>
          <ul className="flex flex-col gap-2">
            {idea.skipped.map(({ ingredient, reason }) => (
              <li key={ingredient} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
                {/* Faded look without fading the text: dashed outline, no shadow. */}
                <span className="flex items-center gap-1 rounded-control border-thin border-dashed border-ink-soft bg-white/70 px-2 py-0.5">
                  <span aria-hidden="true">{emojiFor(ingredient)}</span>
                  {ingredient}
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </StickerCard>
  );
}
