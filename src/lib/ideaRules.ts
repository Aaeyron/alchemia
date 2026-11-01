// Shared by /api/ideas and /api/tweak: request checks, cleaning the model's ideas,
// the plain-code checks (materials, budget, time, uses all) and the single retry.
// Server only (it calls Muse Spark through meta.ts).
import { askSpark, parseJson } from "@/lib/meta";
import type { Idea, IdeaChecks, IdeaUsage, IngredientRole, SkippedIngredient } from "@/lib/types";

// What every idea request needs: the ingredients, the goal and the limits.
export type IdeaRequest = {
  ingredients: string[]; // the cauldron
  goal: string;
  budgetPhp: number;
  timeMinutes: number;
  useEverything: boolean; // optional in the body (default false): ideas must use every ingredient
};

// An idea as the model wrote it, before our clean-up of the recipe and our checks.
// roles/skipped may still use names that don't exactly match the cauldron.
export type RawIdea = Omit<Idea, "checks" | "usage">;

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
  const { ingredients, goal, budgetPhp, timeMinutes, useEverything = false } = body as Record<string, unknown>;

  const goodGoal = typeof goal === "string" && goal.trim() !== "" && goal.length <= 200;
  const goodBudget = typeof budgetPhp === "number" && Number.isFinite(budgetPhp) && budgetPhp >= 0;
  const goodTime = typeof timeMinutes === "number" && Number.isFinite(timeMinutes) && timeMinutes > 0;

  if (!isStringList(ingredients) || !goodGoal || !goodBudget || !goodTime) return null;
  if (typeof useEverything !== "boolean") return null;
  return { ingredients, goal: goal.trim(), budgetPhp, timeMinutes, useEverything };
}

// ---------- Prompt helpers (colors, recipe) ----------

// Rule added to the idea prompts so ideas keep the materials' real colors.
export const COLOR_RULE = `- Materials keep their own colors. Do not suggest painting, coloring, dyeing or decorating
  anything unless a paint, marker or similar item is in the ingredient list. When you describe
  the finished project, use the materials' real colors.`;

// Rules added to the idea prompts so every cauldron ingredient gets a role or a reason.
export function recipeRules(useEverything: boolean): string {
  const everything = useEverything
    ? "\n- The student wants to use EVERY listed ingredient. Use all of them, if it makes sense."
    : "";
  return `- Use as many of the listed ingredients as sensibly possible.${everything}
- roles: for each ingredient you use, what it becomes in the finished project
  (2-6 words, for example "the pen cup").
- skipped: each listed ingredient you do NOT use, with a short reason.
- Every listed ingredient must appear in roles or in skipped. Copy the ingredient names
  exactly from the list (without the color in brackets).`;
}

// One idea in the JSON the model must return (the ideas route wants 3, the tweak route 1).
export const IDEA_JSON_EXAMPLE = `{"title": "short name", "emoji": "one emoji", "description": "one sentence",
  "materialsUsed": ["..."], "timeMinutes": 10, "costPhp": 0, "difficulty": 1,
  "safetyNote": "...", "buildSteps": ["step 1", "step 2"],
  "roles": [{"ingredient": "...", "role": "the pen cup"}],
  "skipped": [{"ingredient": "...", "reason": "too heavy to hold"}]}`;

// Optional { "plastic bottle": "blue", ... } sent alongside the ingredients. Bad input is ignored.
export function readColors(body: unknown): Record<string, string> {
  const colors = (body as Record<string, unknown> | null)?.colors;
  if (typeof colors !== "object" || colors === null) return {};
  const clean: Record<string, string> = {};
  for (const [name, color] of Object.entries(colors).slice(0, 30)) {
    if (typeof color === "string" && color.trim() !== "" && color.length <= 40) {
      clean[name.toLowerCase().trim()] = color.trim();
    }
  }
  return clean;
}

// "plastic bottle (blue), cardboard (brown), tape" — colors where known.
export function listIngredients(ingredients: string[], colors: Record<string, string>): string {
  return ingredients
    .map((name) => {
      const color = colors[name.toLowerCase().trim()];
      return color ? `${name} (${color})` : name;
    })
    .join(", ");
}

// A list of { ingredient, <textField> } pairs from the model; anything malformed is dropped.
function readPairs(value: unknown, textField: "role" | "reason"): { ingredient: string; text: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const ingredient = (item as Record<string, unknown>).ingredient;
    const text = (item as Record<string, unknown>)[textField];
    if (typeof ingredient !== "string" || typeof text !== "string") return [];
    if (ingredient.trim() === "" || text.trim() === "") return [];
    return [{ ingredient: ingredient.trim(), text: text.trim().slice(0, 80) }];
  });
}

// Turn whatever the model sent into a clean list of at most `count` ideas
// (missing fields get safe defaults; a single object is treated as a list of one).
export function cleanIdeas(reply: string, count: number): RawIdea[] {
  const parsed = parseJson<Record<string, unknown>[] | Record<string, unknown>>(reply);
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
    roles: readPairs(raw.roles, "role").map(({ ingredient, text }) => ({ ingredient, role: text })),
    skipped: readPairs(raw.skipped, "reason").map(({ ingredient, text }) => ({ ingredient, reason: text })),
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

// The exact cauldron name a model-written name refers to: same name first, then the loose
// match above. Undefined if it matches nothing (such names are dropped).
function snapToCauldron(name: string, cauldron: string[]): string | undefined {
  const lower = name.toLowerCase().trim();
  return (
    cauldron.find((ingredient) => ingredient.toLowerCase().trim() === lower) ??
    cauldron.find((ingredient) => isIngredient(name, [ingredient]))
  );
}

// The recipe, cleaned up in plain code:
// - "used" comes from materialsUsed (not from the model's roles or counts),
// - every used ingredient gets its role (or "part of the project" if the model gave none),
// - every other cauldron ingredient is skipped, with the model's reason or "No role given".
function buildRecipe(idea: RawIdea, cauldron: string[]) {
  const used = cauldron.filter((name) => idea.materialsUsed.some((m) => isIngredient(m, [name])));
  const skippedNames = cauldron.filter((name) => !used.includes(name));

  const roleFor = new Map<string, string>();
  for (const { ingredient, role } of idea.roles) {
    const name = snapToCauldron(ingredient, cauldron);
    if (name && !roleFor.has(name)) roleFor.set(name, role);
  }
  const reasonFor = new Map<string, string>();
  for (const { ingredient, reason } of idea.skipped) {
    const name = snapToCauldron(ingredient, cauldron);
    if (name && !reasonFor.has(name)) reasonFor.set(name, reason);
  }

  const roles: IngredientRole[] = used.map((name) => ({
    ingredient: name,
    role: roleFor.get(name) ?? "part of the project",
  }));
  const skipped: SkippedIngredient[] = skippedNames.map((name) => ({
    ingredient: name,
    reason: reasonFor.get(name) ?? "No role given",
  }));
  const usage: IdeaUsage = { usedCount: used.length, totalCount: cauldron.length, skippedNames };
  return { roles, skipped, usage };
}

// The checks, done in plain code (not by the model).
function checkIdea(idea: RawIdea, usage: IdeaUsage, req: IdeaRequest): IdeaChecks {
  return {
    materials:
      idea.materialsUsed.length > 0 && idea.materialsUsed.every((m) => isIngredient(m, req.ingredients)),
    budget: idea.costPhp <= req.budgetPhp,
    time: idea.timeMinutes <= req.timeMinutes,
    usesAll: usage.skippedNames.length === 0,
  };
}

function withChecks(ideas: RawIdea[], req: IdeaRequest): Idea[] {
  return ideas.map((idea) => {
    const { roles, skipped, usage } = buildRecipe(idea, req.ingredients);
    return { ...idea, roles, skipped, usage, checks: checkIdea(idea, usage, req) };
  });
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
    // Only a rule when the student asked to use everything; otherwise it's just shown.
    if (req.useEverything && !idea.checks.usesAll) {
      problems.push(`"${idea.title}": You skipped ${idea.usage.skippedNames.join(", ")}. Use every ingredient.`);
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
