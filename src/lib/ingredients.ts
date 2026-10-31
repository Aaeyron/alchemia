// Helpers for the shared ingredient list (safe to use in client code).
import type { Ingredient } from "@/lib/types";

export const MAX_INGREDIENTS = 30;
export const MAX_NAME_LENGTH = 40;

// Simple unique ids for this browser session (works on http:// too, unlike crypto.randomUUID).
let nextId = 0;
export function newId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

// Same name, ignoring upper/lower case and surrounding spaces.
export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function findByName(list: Ingredient[], name: string): Ingredient | undefined {
  return list.find((ingredient) => sameName(ingredient.name, name));
}

/**
 * Add items to the list and return the new list. Duplicates (same name, any case) are merged.
 * A typed item that later shows up in a photo now counts as seen in that photo.
 * Stops adding at MAX_INGREDIENTS.
 */
export function mergeIngredients(
  list: Ingredient[],
  items: { name: string; detail?: string }[],
  source: Ingredient["source"],
  photoId?: string
): Ingredient[] {
  const next = [...list];
  for (const item of items) {
    const name = item.name.trim();
    if (name === "") continue;

    const existing = findByName(next, name);
    if (existing) {
      if (existing.source === "typed" && source === "photo") {
        next[next.indexOf(existing)] = { ...existing, source: "photo", photoId, detail: item.detail };
      }
      continue;
    }

    if (next.length >= MAX_INGREDIENTS) break;
    next.push({ id: newId("ingredient"), name, source, photoId, detail: item.detail });
  }
  return next;
}
