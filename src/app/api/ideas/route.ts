import { askForIdeas, readIdeaRequest, type IdeaRequest } from "@/lib/ideaRules";

function buildPrompt({ ingredients, goal, budgetPhp, timeMinutes }: IdeaRequest): string {
  return `You are Alchemia, a friendly invention helper for students.

Goal: ${goal}
Ingredients (the ONLY materials available): ${ingredients.join(", ")}
Budget: ₱${budgetPhp}
Time limit: ${timeMinutes} minutes

Invent exactly 3 different things the student can make to reach the goal.
Rules:
- Use ONLY the listed ingredients. No other materials. Do not assume tools like scissors,
  tape or glue unless they are in the list.
- In materialsUsed, write each ingredient name exactly as it appears in the list.
- costPhp must be at most ${budgetPhp}. timeMinutes must be at most ${timeMinutes}.
- Write in simple, friendly English a student can follow.
- safetyNote: if the idea involves sharp tools, heat, electricity or chemicals, give a
  short safety tip. Otherwise write "Looks safe!".

Return JSON only — no explanation, no markdown — as an array of exactly 3 objects:
[{"title": "short name", "emoji": "one emoji", "description": "one sentence",
  "materialsUsed": ["..."], "timeMinutes": 10, "costPhp": 0, "difficulty": 1,
  "safetyNote": "...", "buildSteps": ["step 1", "step 2"]}]`;
}

// POST /api/ideas — body: { ingredients, goal, budgetPhp, timeMinutes }
export async function POST(request: Request) {
  let req: IdeaRequest | null;
  try {
    req = readIdeaRequest(await request.json());
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
    const ideas = await askForIdeas(buildPrompt(req), req, 3);
    return Response.json({ ideas });
  } catch (err) {
    console.error("ideas failed:", err);
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  }
}
