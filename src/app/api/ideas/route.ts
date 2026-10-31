import { askSpark, parseJson } from "@/lib/meta";
import type { Idea, IdeaChecks } from "@/lib/types";

type IdeaRequest = {
  ingredients: string[];
  goal: string;
  budgetPhp: number;
  timeMinutes: number;
};

// An idea before our checks are attached.
type RawIdea = Omit<Idea, "checks">;

// Check the request body. Returns null if anything is missing or the wrong type.
function readRequest(body: unknown): IdeaRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { ingredients, goal, budgetPhp, timeMinutes } = body as Record<string, unknown>;

  const goodIngredients =
    Array.isArray(ingredients) &&
    ingredients.length > 0 &&
    ingredients.length <= 30 &&
    ingredients.every((i) => typeof i === "string" && i.trim() !== "");
  const goodGoal = typeof goal === "string" && goal.trim() !== "" && goal.length <= 200;
  const goodBudget = typeof budgetPhp === "number" && Number.isFinite(budgetPhp) && budgetPhp >= 0;
  const goodTime = typeof timeMinutes === "number" && Number.isFinite(timeMinutes) && timeMinutes > 0;

  if (!goodIngredients || !goodGoal || !goodBudget || !goodTime) return null;
  return { ingredients: ingredients as string[], goal: goal.trim(), budgetPhp, timeMinutes };
}

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

// Turn whatever the model sent into a clean list of ideas (missing fields get safe defaults).
function cleanIdeas(reply: string): RawIdea[] {
  const parsed = parseJson<Partial<RawIdea>[]>(reply);
  if (!Array.isArray(parsed)) throw new Error("Muse Spark didn't return a list of ideas.");

  return parsed.slice(0, 3).map((raw) => ({
    title: String(raw.title ?? "Mystery invention"),
    emoji: String(raw.emoji ?? "✨"),
    description: String(raw.description ?? ""),
    materialsUsed: Array.isArray(raw.materialsUsed) ? raw.materialsUsed.map(String) : [],
    timeMinutes: Number(raw.timeMinutes) || 0,
    costPhp: Number(raw.costPhp) || 0,
    difficulty: Math.min(3, Math.max(1, Math.round(Number(raw.difficulty) || 1))) as 1 | 2 | 3,
    safetyNote: String(raw.safetyNote ?? "Looks safe!"),
    buildSteps: Array.isArray(raw.buildSteps) ? raw.buildSteps.map(String) : [],
  }));
}

// Does this material match one of the ingredients? (case-insensitive, substring either way)
function isIngredient(material: string, ingredients: string[]): boolean {
  const m = material.toLowerCase().trim();
  return ingredients.some((ingredient) => {
    const i = ingredient.toLowerCase().trim();
    return m.includes(i) || i.includes(m);
  });
}

// The 3 checks, done in plain code (not by the model).
function checkIdea(idea: RawIdea, req: IdeaRequest): IdeaChecks {
  return {
    materials:
      idea.materialsUsed.length > 0 && idea.materialsUsed.every((m) => isIngredient(m, req.ingredients)),
    budget: idea.costPhp <= req.budgetPhp,
    time: idea.timeMinutes <= req.timeMinutes,
  };
}

function withChecks(ideas: RawIdea[], req: IdeaRequest): Idea[] {
  return ideas.map((idea) => ({ ...idea, checks: checkIdea(idea, req) }));
}

// Describe which rules were broken, in short sentences for the retry prompt.
function listProblems(ideas: Idea[], req: IdeaRequest): string[] {
  const problems: string[] = [];
  if (ideas.length < 3) problems.push(`You returned ${ideas.length} ideas instead of exactly 3.`);

  for (const idea of ideas) {
    if (!idea.checks.materials) {
      const extras = idea.materialsUsed.filter((m) => !isIngredient(m, req.ingredients));
      problems.push(
        extras.length > 0
          ? `"${idea.title}" uses ${extras.map((m) => `"${m}"`).join(", ")}, which are not in the ingredient list.`
          : `"${idea.title}" has an empty materialsUsed list.`
      );
    }
    if (!idea.checks.budget) {
      problems.push(`"${idea.title}" costs ₱${idea.costPhp}, over the ₱${req.budgetPhp} budget.`);
    }
    if (!idea.checks.time) {
      problems.push(`"${idea.title}" takes ${idea.timeMinutes} minutes, over the ${req.timeMinutes}-minute limit.`);
    }
  }
  return problems;
}

// POST /api/ideas — body: { ingredients, goal, budgetPhp, timeMinutes }
export async function POST(request: Request) {
  let req: IdeaRequest | null;
  try {
    req = readRequest(await request.json());
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
    const prompt = buildPrompt(req);
    const firstReply = await askSpark(prompt);
    let ideas = withChecks(cleanIdeas(firstReply), req);

    // If any rule was broken, ask Muse Spark once more to fix it.
    const problems = listProblems(ideas, req);
    if (problems.length > 0) {
      const retryPrompt = `${prompt}

Your previous answer was:
${firstReply}

It broke these rules:
- ${problems.join("\n- ")}

Fix the problems and return all 3 ideas again, JSON only.`;

      try {
        ideas = withChecks(cleanIdeas(await askSpark(retryPrompt)), req);
      } catch (err) {
        // The retry failed outright; keep the first ideas (their failing badges will show).
        console.error("ideas retry failed:", err);
      }
    }

    return Response.json({ ideas });
  } catch (err) {
    console.error("ideas failed:", err);
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  }
}
