import {
  COLOR_RULE,
  IDEA_JSON_EXAMPLE,
  askForIdeas,
  recipeRules,
  listIngredients,
  readColors,
  readIdeaRequest,
  type IdeaRequest,
} from "@/lib/ideaRules";
import { checkRateLimit } from "@/lib/rateLimit";

// Vercel Hobby allows up to 300 s per function (the plan's maximum).
// Ideas can need two Spark calls (first answer + one retry).
export const maxDuration = 300;

function buildPrompt(
  { ingredients, goal, budgetPhp, timeMinutes, useEverything }: IdeaRequest,
  colors: Record<string, string>
): string {
  return `You are Alchemia, a friendly invention helper for students.

Goal: ${goal}
Ingredients (the ONLY materials available; colors in brackets): ${listIngredients(ingredients, colors)}
Budget: ₱${budgetPhp}
Time limit: ${timeMinutes} minutes

Invent exactly 3 different things the student can make to reach the goal.
Rules:
- Use ONLY the listed ingredients. No other materials. Do not assume tools like scissors,
  tape or glue unless they are in the list.
- In materialsUsed, write each ingredient name exactly as it appears in the list
  (without the color in brackets).
- costPhp must be at most ${budgetPhp}. timeMinutes must be at most ${timeMinutes}.
${recipeRules(useEverything)}
${COLOR_RULE}
- Write in simple, friendly English a student can follow.
- safetyNote: if the idea involves sharp tools, heat, electricity or chemicals, give a
  short safety tip. Otherwise write "Looks safe!".

Return JSON only — no explanation, no markdown — as an array of exactly 3 objects:
[${IDEA_JSON_EXAMPLE}]`;
}

// POST /api/ideas — body: { ingredients, goal, budgetPhp, timeMinutes, colors?, useEverything? }
export async function POST(request: Request) {
  const limited = checkRateLimit(request, "ideas");
  if (limited) return limited;

  let req: IdeaRequest | null;
  let colors: Record<string, string> = {};
  try {
    const body = await request.json();
    req = readIdeaRequest(body);
    colors = readColors(body);
  } catch {
    req = null; // body wasn't valid JSON
  }
  if (!req) {
    return Response.json(
      { error: "Please send ingredients, a goal, a budget and a time limit." },
      { status: 400 }
    );
  }

  try {
    // Checks each idea in code and retries once if any rule was broken (see ideaRules.ts).
    const ideas = await askForIdeas(buildPrompt(req, colors), req, 3);
    return Response.json({ ideas });
  } catch (err) {
    // Details stay in the server log; the visitor gets a friendly message.
    console.error("ideas failed:", err);
    return Response.json(
      { error: "Alchemia couldn't brew ideas right now. Please try again." },
      { status: 500 }
    );
  }
}
