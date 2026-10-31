// Shared by /api/ideas and /api/tweak: request checks, cleaning the model's ideas,
// the 3 plain-code checks (materials, budget, time) and the single retry.
// Server only (it calls Muse Spark through meta.ts).
import { askSpark, parseJson } from "@/lib/meta";
import type { Idea, IdeaChecks } from "@/lib/types";

// What every idea request needs: the ingredients, the goal and the limits.
export type IdeaRequest = {
  ingredients: string[];
  goal: string;
  budgetPhp: number;
  timeMinutes: number;
};

// An idea before our checks are attached.
export type RawIdea = Omit<Idea, "checks">;

export function isStringList(value: unknown, max = 30): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= max &&
    value.every((item) => typeof item === "string" && item.trim() !== "")
  );
}

// Check the request body. Returns null if anything is missing or the wrong type.
export function readIdeaRequest(body: unknown): IdeaRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { ingredients, goal, budgetPhp, timeMinutes } = body as Record<string, unknown>;

  const goodGoal = typeof goal === "string" && goal.trim() !== "" && goal.length <= 200;
  const goodBudget = typeof budgetPhp === "number" && Number.isFinite(budgetPhp) && budgetPhp >= 0;
  const goodTime = typeof timeMinutes === "number" && Number.isFinite(timeMinutes) && timeMinutes > 0;

  if (!isStringList(ingredients) || !goodGoal || !goodBudget || !goodTime) return null;
  return { ingredients, goal: goal.trim(), budgetPhp, timeMinutes };
}

// Turn whatever the model sent into a clean list of at most `count` ideas
// (missing fields get safe defaults; a single object is treated as a list of one).
export function cleanIdeas(reply: string, count: number): RawIdea[] {
  const parsed = parseJson<Partial<RawIdea>[] | Partial<RawIdea>>(reply);
  const list = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null ? [parsed] : null;
  if (!list) throw new Error("Muse Spark didn't return a list of ideas.");

  return list.slice(0, count).map((raw) => ({
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

// Does this item match one of the names in the list? (case-insensitive, substring either way)
export function isIngredient(item: string, ingredients: string[]): boolean {
  const m = item.toLowerCase().trim();
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
function listProblems(ideas: Idea[], req: IdeaRequest, count: number): string[] {
  const problems: string[] = [];
  if (ideas.length < count) problems.push(`You returned ${ideas.length} ideas instead of exactly ${count}.`);

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

/**
 * Ask Muse Spark for `count` ideas, check them in code, and if any rule was broken,
 * ask once more with the list of problems. The corrected result is used even if it
 * still fails (the failing badges will show). If the retry itself errors, the first
 * ideas are kept.
 */
export async function askForIdeas(prompt: string, req: IdeaRequest, count: number): Promise<Idea[]> {
  const firstReply = await askSpark(prompt);
  let ideas = withChecks(cleanIdeas(firstReply, count), req);

  const problems = listProblems(ideas, req, count);
  if (problems.length > 0) {
    const returnWhat = count === 1 ? "the idea" : `all ${count} ideas`;
    const retryPrompt = `${prompt}

Your previous answer was:
${firstReply}

It broke these rules:
- ${problems.join("\n- ")}

Fix the problems and return ${returnWhat} again, JSON only.`;

    try {
      ideas = withChecks(cleanIdeas(await askSpark(retryPrompt), count), req);
    } catch (err) {
      console.error("ideas retry failed:", err);
    }
  }

  return ideas;
}
