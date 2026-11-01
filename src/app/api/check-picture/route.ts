import { isIngredient, isStringList } from "@/lib/ideaRules";
import { askSpark, parseJson } from "@/lib/meta";
import { checkRateLimit } from "@/lib/rateLimit";
import type { PictureCheck } from "@/lib/types";

// Vercel Hobby allows up to 300 s per function (the plan's maximum).
export const maxDuration = 300;

type CheckRequest = {
  image: string; // the concept picture, downscaled by the page (data URL)
  ingredients: string[]; // the ingredients this idea uses
  cauldron: string[]; // everything in the cauldron
};

// Check the request body. Returns null if anything is missing or the wrong type.
function readRequest(body: unknown): CheckRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { image, ingredients, cauldron } = body as Record<string, unknown>;

  const goodImage = typeof image === "string" && image.startsWith("data:image/");
  const goodNames = (list: unknown) =>
    isStringList(list) && list.every((name) => name.length <= 80);

  if (!goodImage || !goodNames(ingredients) || !goodNames(cauldron)) return null;
  return { image, ingredients: ingredients as string[], cauldron: cauldron as string[] };
}

function buildPrompt(ingredients: string[]): string {
  return `List the distinct physical objects you can see that are used to build the project,
in short noun phrases. JSON only: { "seen": string[], "extras": string[] } where extras are
objects that look like part of the project but are NOT in this ingredient list: ${ingredients.join(", ")}.
Ignore the table, the background and shadows.`;
}

// Short, trimmed strings from whatever the model put in this field (anything else is dropped).
function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 60))
    .filter((item) => item !== "")
    .slice(0, 20);
}

// The comparison, in plain code (the model only says what it sees).
// Everything it listed (seen + its own extras) counts as "in the picture".
function compare(inPicture: string[], { ingredients, cauldron }: CheckRequest): PictureCheck {
  const matched = ingredients.filter((ingredient) => inPicture.some((item) => isIngredient(item, [ingredient])));
  const missing = ingredients.filter((ingredient) => !matched.includes(ingredient));
  const known = [...ingredients, ...cauldron];
  const extras = [...new Set(inPicture.filter((item) => !isIngredient(item, known)))];
  return { matched, missing, extras };
}

// POST /api/check-picture — body: { image, ingredients, cauldron }
export async function POST(request: Request) {
  const limited = checkRateLimit(request, "check-picture");
  if (limited) return limited;

  let req: CheckRequest | null;
  try {
    req = readRequest(await request.json());
  } catch {
    req = null; // body wasn't valid JSON
  }
  if (!req) {
    return Response.json(
      { error: "Please send the picture as a data URL, the idea's ingredients and the cauldron." },
      { status: 400 }
    );
  }

  try {
    const raw = parseJson<Record<string, unknown>>(await askSpark(buildPrompt(req.ingredients), req.image));
    const reply = typeof raw === "object" && raw !== null ? raw : {};
    const inPicture = [...cleanList(reply.seen), ...cleanList(reply.extras)];
    // Only our own comparison goes back to the page, never the model's text.
    return Response.json(compare(inPicture, req));
  } catch (err) {
    // Details stay in the server log; the visitor gets a friendly message.
    console.error("check-picture failed:", err);
    return Response.json(
      { error: "Alchemia couldn't double-check this picture right now." },
      { status: 500 }
    );
  }
}
