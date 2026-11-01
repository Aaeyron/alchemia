import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { emojiFor } from "@/lib/emoji";
import type { Ingredient } from "@/lib/types";

type IngredientChipProps = {
  ingredient: Ingredient;
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
};

// An ingredient chip (✍️ if typed) with a little ✕ in the corner to remove it from the list.
export function IngredientChip({ ingredient, selected, onToggle, onRemove }: IngredientChipProps) {
  return (
    <span className="relative inline-flex">
      <Chip
        emoji={emojiFor(ingredient.name)}
        label={ingredient.name}
        selected={selected}
        onToggle={onToggle}
        title={[ingredient.color, ingredient.material].filter(Boolean).join(" · ") || undefined}
        badge={ingredient.source === "typed" ? "✍️" : undefined}
      />
      {/* The ✕ looks small, but the invisible ::after area makes it a 44px tap target. */}
      <Button
        variant="danger"
        size="icon"
        onClick={onRemove}
        aria-label={`Remove ${ingredient.name}`}
        className="absolute -top-2 -right-2 after:absolute after:-inset-2 after:content-['']"
      >
        ✕
      </Button>
    </span>
  );
}
