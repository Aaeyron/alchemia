import { emojiFor } from "@/lib/emoji";
import { matchIngredient } from "@/lib/ingredients";
import type { Ingredient } from "@/lib/types";

type IngredientStickersProps = {
  names: string[];
  ingredients: Ingredient[]; // the shared list, for colors
  label: string; // what the list is, for screen readers ("Ingredients for this step")
};

// A row of little ingredient stickers: emoji, name and color (when known).
export function IngredientStickers({ names, ingredients, label }: IngredientStickersProps) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {names.map((name) => {
        const color = matchIngredient(ingredients, name)?.color;
        return (
          <li
            key={name}
            className="flex items-center gap-1 rounded-control border-thin border-ink bg-white px-2 py-0.5 text-base shadow-sticker-sm"
          >
            <span aria-hidden="true">{emojiFor(name)}</span>
            {name}
            {color && <span className="text-sm text-ink-soft">· {color}</span>}
          </li>
        );
      })}
    </ul>
  );
}

// "★★☆" for a difficulty of 2, read out as "Difficulty 2 of 3".
export function DifficultyStars({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span>
      <span aria-hidden="true">{"★".repeat(level) + "☆".repeat(3 - level)}</span>
      <span className="sr-only">Difficulty {level} of 3</span>
    </span>
  );
}
