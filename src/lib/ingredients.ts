// Helpers for the shared ingredient list (safe to use in client code).
import type { Ingredient, MaterialInfo } from "@/lib/types";

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

// Find the ingredient an idea's material refers to: exact name first, then a loose
// "one name contains the other" match (the same rule the server's materials check uses).
export function matchIngredient(list: Ingredient[], name: string): Ingredient | undefined {
  const lower = name.trim().toLowerCase();
  return (
    findByName(list, name) ??
    list.find((ingredient) => {
      const other = ingredient.name.trim().toLowerCase();
      return lower.includes(other) || other.includes(lower);
    })
  );
}

// What we know about each material an idea uses (unknown materials count as typed, no color).
export function describeMaterials(list: Ingredient[], materialsUsed: string[]): MaterialInfo[] {
  return materialsUsed.map((name) => {
    const ingredient = matchIngredient(list, name);
    return {
      name,
      color: ingredient?.color,
      material: ingredient?.material,
      source: ingredient?.source ?? "typed",
    };
  });
}

// Color words we recognise in a typed name, e.g. "red tape" -> "red".
const COLOR_WORDS = [
  "red", "orange", "yellow", "green", "blue", "purple", "violet", "pink", "brown", "black",
  "white", "gray", "grey", "beige", "clear", "transparent", "silver", "gold",
];

export function colorFromName(name: string): string | undefined {
  const words = name.toLowerCase().split(/[^a-z]+/);
  return COLOR_WORDS.find((color) => words.includes(color));
}

type NewItem = { name: string; color?: string; material?: string };

/**
 * Add items to the list and return the new list. Duplicates (same name, any case) are merged,
 * and a known color/material is never lost when merging.
 * A typed item that later shows up in a photo now counts as seen in that photo
 * (and takes the photo's color, since that one is real).
 * Stops adding at MAX_INGREDIENTS.
 */
export function mergeIngredients(
  list: Ingredient[],
  items: NewItem[],
  source: Ingredient["source"],
  photoId?: string
): Ingredient[] {
  const next = [...list];
  for (const item of items) {
    const name = item.name.trim();
    if (name === "") continue;

    const existing = findByName(next, name);
    if (existing) {
      const seenInPhotoNow = existing.source === "typed" && source === "photo";
      next[next.indexOf(existing)] = seenInPhotoNow
        ? {
            ...existing,
            source: "photo",
            photoId,
            color: item.color ?? existing.color,
            material: item.material ?? existing.material,
          }
        : {
            ...existing,
            color: existing.color ?? item.color,
            material: existing.material ?? item.material,
          };
      continue;
    }

    if (next.length >= MAX_INGREDIENTS) break;
    next.push({ id: newId("ingredient"), name, source, photoId, color: item.color, material: item.material });
  }
  return next;
}
