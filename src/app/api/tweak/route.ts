import {
  COLOR_RULE,
  askForIdeas,
  isIngredient,
  isStringList,
  listIngredients,
  readColors,
  readIdeaRequest,
  type IdeaRequest,
} from "@/lib/ideaRules";
import { checkRateLimit } from "@/lib/rateLimit";

// Vercel Hobby allows up to 300 s per function (the plan's maximum).
// A tweak can need two Spark calls (first answer + one retry).
export const maxDuration = 300;

type Tweak = "missing" | "weird" | "easier";
const TWEAKS: Tweak[] = ["missing", "weird", "easier"];

// The parts of the current idea we show the model (the checks are ours, not its business).
type CurrentIdea = {
  title: string;
  description: string;
  materialsUsed: string[];
  timeMinutes: number;
  costPhp: number;
  difficulty: number;
  buildSteps: string[];
};

type TweakRequest = IdeaRequest & {
  idea: CurrentIdea;
  tweak: Tweak;
  missing: string[];
  colors: Record<string, string>; // optional colors per ingredient name, for the prompt
};

// Check the request body. Returns null if anything is missing or the wrong type.
function readTweakRequest(body: unknown): TweakRequest | null {
  const base = readIdeaRequest(body);
  if (!base) return null;
  const { idea, tweak, missing } = body as Record<string, unknown>;

  if (!TWEAKS.includes(tweak as Tweak)) return null;
  if (tweak === "missing" && !isStringList(missing)) return null;

  if (typeof idea !== "object" || idea === null) return null;
  const { title, description, materialsUsed, timeMinutes, costPhp, difficulty, buildSteps } =
    idea as Record<string, unknown>;
  const goodIdea =
    typeof title === "string" &&
    title.trim() !== "" &&
    title.length <= 120 &&
    typeof description === "string" &&
    description.length <= 500 &&
    isStringList(materialsUsed) &&
    Array.isArray(buildSteps) &&
    buildSteps.length <= 20 &&
    buildSteps.every((step) => typeof step === "string" && step.length <= 500);
  if (!goodIdea) return null;

  return {
    ...base,
    idea: {
      title,
      description,
      materialsUsed,
      timeMinutes: Number(timeMinutes) || 0,
      costPhp: Number(costPhp) || 0,
      difficulty: Number(difficulty) || 1,
      buildSteps: buildSteps as string[],
    },
    tweak: tweak as Tweak,
    missing: tweak === "missing" ? (missing as string[]) : [],
    colors: readColors(body),
  };
}

// What we want the model to change, written in code for each tweak.
function tweakInstruction(req: TweakRequest): string {
  switch (req.tweak) {
    case "missing":
      return `The student does NOT have: ${req.missing.join(", ")}.
Redesign the idea for the SAME goal using ONLY the ingredients listed above.
If a missing item can be replaced by one of the remaining ingredients, say so in the
description (for example: "Uses the cup instead of the bottle").`;
    case "weird":
      return `Make an unexpected, playful, imaginative version of this idea.
Keep the same goal, the same ingredients and the same limits.
It must still be buildable and safe.`;
    case "easier":
      return `Make this idea easier: fewer build steps, fewer materials, a shorter time and an
easier difficulty than the current version. Keep the same goal.`;
  }
}

function buildPrompt(req: TweakRequest): string {
  return `You are Alchemia, a friendly invention helper for students.

Goal: ${req.goal}
Ingredients (the ONLY materials available; colors in brackets): ${listIngredients(req.ingredients, req.colors)}
Budget: ₱${req.budgetPhp}
Time limit: ${req.timeMinutes} minutes

Here is the current idea (JSON):
${JSON.stringify(req.idea)}

${tweakInstruction(req)}

Rules:
- Use ONLY the listed ingredients. No other materials. Do not assume tools like scissors,
  tape or glue unless they are in the list.
- In materialsUsed, write each ingredient name exactly as it appears in the list
  (without the color in brackets).
- costPhp must be at most ${req.budgetPhp}. timeMinutes must be at most ${req.timeMinutes}.
${COLOR_RULE}
- Write in simple, friendly English a student can follow.
- safetyNote: if the idea involves sharp tools, heat, electricity or chemicals, give a
  short safety tip. Otherwise write "Looks safe!".

Return JSON only — no explanation, no markdown — as an array with exactly 1 object:
[{"title": "short name", "emoji": "one emoji", "description": "one sentence",
  "materialsUsed": ["..."], "timeMinutes": 10, "costPhp": 0, "difficulty": 1,
  "safetyNote": "...", "buildSteps": ["step 1", "step 2"]}]`;
}

// POST /api/tweak — body: { idea, ingredients, goal, budgetPhp, timeMinutes, tweak, missing?, colors? }
export async function POST(request: Request) {
  const limited = checkRateLimit(request, "tweak");
  if (limited) return limited;

  let req: TweakRequest | null;
  try {
    req = readTweakRequest(await request.json());
  } catch {
    req = null; // body wasn't valid JSON
  }
  if (!req) {
    return Response.json(
      { error: "Please send the idea, ingredients, goal, limits and which tweak to make." },
      { status: 400 }
    );
  }

  // "I don't have…": drop the missing items, so both the prompt and the materials check use the shorter list.
  if (req.tweak === "missing") {
    const missing = req.missing;
    req = { ...req, ingredients: req.ingredients.filter((ingredient) => !isIngredient(ingredient, missing)) };
    if (req.ingredients.length === 0) {
      return Response.json(
        { error: "That leaves no ingredients to build with. Keep at least one!" },
        { status: 400 }
      );
    }
  }

  try {
    // Same checks and single retry as /api/ideas, but for exactly one idea.
    const [idea] = await askForIdeas(buildPrompt(req), req, 1);
    if (!idea) throw new Error("Muse Spark didn't return an idea.");
    return Response.json({ idea, ingredients: req.ingredients });
  } catch (err) {
    // Details stay in the server log; the visitor gets a friendly message.
    console.error("tweak failed:", err);
    return Response.json(
      { error: "Alchemia couldn't change the idea right now. Please try again." },
      { status: 500 }
    );
  }
}
