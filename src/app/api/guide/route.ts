import { isStringList, readRoles, snapToCauldron } from "@/lib/ideaRules";
import { askSpark, parseJson } from "@/lib/meta";
import { checkRateLimit } from "@/lib/rateLimit";
import type { BuildGuide, GuideOverview, GuideStep, IngredientRole } from "@/lib/types";

// Vercel Hobby allows up to 300 s per function (the plan's maximum).
// A guide can need two Spark calls (first answer + one retry).
export const maxDuration = 300;

const MIN_STEPS = 3;
const MAX_STEPS = 8;

// The parts of the idea the guide is written from (all trimmed and cut to size).
type GuideRequest = {
  idea: {
    title: string;
    description: string;
    materialsUsed: string[];
    roles: IngredientRole[];
    buildSteps: string[];
    safetyNote: string;
    timeMinutes: number;
    difficulty: 1 | 2 | 3;
  };
  ingredients: string[]; // the cauldron for this version of the idea
};

// Model text can be long, so text fields are cut to size instead of refused;
// only something absurd (or the wrong type) is a bad request.
function readText(value: unknown, max: number): string | null {
  if (typeof value !== "string" || value.length > 5000) return null;
  return value.trim().slice(0, max);
}

const toDifficulty = (value: unknown): 1 | 2 | 3 =>
  Math.min(3, Math.max(1, Math.round(Number(value) || 1))) as 1 | 2 | 3;

// Check the request body. Returns null if anything is missing or the wrong type.
function readGuideRequest(body: unknown): GuideRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { idea, ingredients } = body as Record<string, unknown>;
  if (typeof idea !== "object" || idea === null) return null;
  const raw = idea as Record<string, unknown>;

  const title = readText(raw.title, 120);
  const description = readText(raw.description ?? "", 500);
  const safetyNote = readText(raw.safetyNote ?? "", 300);
  const roles = readRoles(raw.roles);
  const buildSteps = raw.buildSteps ?? [];
  const goodSteps =
    Array.isArray(buildSteps) &&
    buildSteps.length <= 20 &&
    buildSteps.every((step) => typeof step === "string" && step.length <= 5000);
  const timeMinutes = Number(raw.timeMinutes);

  if (
    !title ||
    description === null ||
    safetyNote === null ||
    !roles ||
    !goodSteps ||
    !isStringList(raw.materialsUsed) ||
    !isStringList(ingredients) ||
    (ingredients as string[]).some((name) => name.length > 80) ||
    !Number.isFinite(timeMinutes) ||
    timeMinutes <= 0
  ) {
    return null;
  }

  return {
    idea: {
      title,
      description,
      materialsUsed: (raw.materialsUsed as string[]).map((name) => name.trim().slice(0, 80)),
      roles,
      buildSteps: (buildSteps as string[]).map((step) => step.trim().slice(0, 500)).filter(Boolean),
      safetyNote,
      timeMinutes: Math.round(timeMinutes),
      difficulty: toDifficulty(raw.difficulty),
    },
    ingredients: (ingredients as string[]).map((name) => name.trim()),
  };
}

// ---------- The prompt ----------

// One step object, to anchor the format (few-shot).
const STEP_EXAMPLE = `{"title": "Cut the bottle in half", "instruction": "Lay the bottle on its side. If you have scissors, cut all the way around it about a hand's width (10 cm) up from the bottom. If not, ask a grown-up to cut it for you.", "ingredients": ["plastic bottle"], "tools": [], "tip": "Draw a line first so the cut is straight.", "safety": "Cut edges can be sharp. Ask a grown-up to help.", "minutes": 3, "difficulty": 2, "result": "The bottle is cut in half; the bottom half stands upright on the table, with a smooth rim."}`;

function buildPrompt({ idea, ingredients }: GuideRequest): string {
  const roles = idea.roles.map(({ ingredient, role }) => `${ingredient} is ${role}`).join("; ");
  const steps = idea.buildSteps.map((step, i) => `${i + 1}. ${step}`).join(" ");

  return `You write clear, friendly build guides for students.
The reader is a student with basic tools at most, building alone at a desk.
Priorities, in this order: safe > buildable with these ingredients > matches the idea > fits the time.

Task: Expand this idea into a step-by-step build guide.

Idea title: ${idea.title}
Idea description: ${idea.description || "(none)"}
Ingredients this idea uses: ${idea.materialsUsed.join(", ")}
What each ingredient becomes: ${roles || "(not given)"}
Current short steps: ${steps || "(none)"}
Safety note: ${idea.safetyNote || "(none)"}
Total time: about ${idea.timeMinutes} minutes
Ingredient list (the ONLY materials available): ${ingredients.join(", ")}

Rules:
1. Write ${MIN_STEPS} to ${MAX_STEPS} steps, in a logical build order. The steps' minutes should add up to about ${idea.timeMinutes}.
2. Use ONLY the ingredients in the list. Copy their names exactly. Do not invent tools unless
   they are in the ingredient list. If a step needs a common tool that is not listed (like
   scissors or tape), say "if you have it" and give a way to do it without that tool (for
   example: tear along a sharp fold, tie with string, fold a tab).
3. Use simple words. One action per sentence. At most 3 sentences per step.
   Be concrete: say which part goes where, and give real sizes or simple references when
   they help ("about 10 cm", "about a hand's width", "two fingers from the top").
   Every join must say how it is made (tie, wrap, fold, slot, tuck).
   Avoid vague steps like "decorate it", "assemble the parts" or "attach A to B" with no method.
   Make sure openings are wide enough for what the object holds or stores. If a container's
   opening is too narrow (like a bottle neck), cut it wider or choose another design.
4. Any step with cutting, heat, electricity or chemicals needs a safety note. Include
   "Ask a grown-up to help" where it fits. Otherwise safety is "".
5. "result": at most 25 words describing how the project looks AFTER this step. Describe only
   the object and the ingredients. No people, no hands.
6. "ingredients": the ingredients this step uses as parts of the project. "tools": items from
   the ingredient list used as tools in this step ([] if none). "difficulty": 1 (easy),
   2 (medium) or 3 (hard).

Example of ONE step object:
${STEP_EXAMPLE}

BAD instruction (do NOT write like this): "Attach the cardboard to the bottle and decorate it."
Why it is bad: it does not say how to attach, and "decorate" is not a clear action.

Return JSON only (no explanation, no markdown), exactly this shape:
{"steps": [ {"title": string (max 6 words), "instruction": string, "ingredients": string[], "tools": string[], "tip": string, "safety": string, "minutes": number, "difficulty": 1 | 2 | 3, "result": string} ]}`;
}

// ---------- Cleaning the model's answer (plain code, not the model) ----------

type CleanedGuide = {
  steps: GuideStep[];
  stepCountFromModel: number; // before cutting to MAX_STEPS
  problems: string[]; // broken rules, for the retry prompt
};

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// Snap each name to its exact cauldron name; names that match nothing are dropped and reported.
function snapNames(value: unknown, cauldron: string[]): { names: string[]; unknown: string[] } {
  const names: string[] = [];
  const unknown: string[] = [];
  if (!Array.isArray(value)) return { names, unknown };
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "") continue;
    const name = snapToCauldron(item, cauldron);
    if (!name) unknown.push(item.trim().slice(0, 80));
    else if (!names.includes(name)) names.push(name);
  }
  return { names, unknown };
}

function cleanGuide(reply: string, req: GuideRequest): CleanedGuide {
  const parsed = parseJson<{ steps?: unknown } | unknown[]>(reply);
  const rawSteps = Array.isArray(parsed) ? parsed : parsed?.steps;
  if (!Array.isArray(rawSteps)) throw new Error("Muse Spark didn't return a list of steps.");

  const problems: string[] = [];
  const steps: GuideStep[] = [];
  for (const item of rawSteps) {
    if (typeof item !== "object" || item === null) continue;
    const raw = item as Record<string, unknown>;
    const instruction = text(raw.instruction, 400);
    if (instruction === "") continue;
    const number = steps.length + 1;

    const ingredients = snapNames(raw.ingredients, req.ingredients);
    const tools = snapNames(raw.tools, req.ingredients);
    for (const name of ingredients.unknown) {
      problems.push(`Step ${number} uses "${name}", which is not in the ingredient list.`);
    }
    for (const name of tools.unknown) {
      problems.push(`Step ${number} uses the tool "${name}", which is not in the ingredient list.`);
    }

    steps.push({
      title: text(raw.title, 60) || `Step ${number}`,
      instruction,
      ingredients: ingredients.names,
      tools: tools.names,
      tip: text(raw.tip, 160),
      safety: text(raw.safety, 200),
      minutes: Math.max(1, Math.round(Number(raw.minutes) || 1)),
      difficulty: raw.difficulty === undefined ? req.idea.difficulty : toDifficulty(raw.difficulty),
      result: text(raw.result, 200),
    });
  }

  if (steps.length < MIN_STEPS || steps.length > MAX_STEPS) {
    problems.unshift(`You returned ${steps.length} steps instead of ${MIN_STEPS} to ${MAX_STEPS}.`);
  }
  return { steps: steps.slice(0, MAX_STEPS), stepCountFromModel: steps.length, problems };
}

// ---------- Fallback: the simple guide from the idea's own steps ----------

// Steps that mention these words get a safety note in the simple guide.
const CAREFUL_WORDS = /\b(cut|cutting|knife|blade|scissors|sharp|hot|heat|iron|glue gun|flame|fire|candle|electric|battery|batteries|wire|plug|chemical|bleach)\b/i;

function simpleGuide(req: GuideRequest): GuideStep[] {
  const { idea } = req;
  const minutes = Math.max(1, Math.round(idea.timeMinutes / Math.max(1, idea.buildSteps.length)));
  const ideaSafety = /looks safe/i.test(idea.safetyNote) ? "" : idea.safetyNote;

  return idea.buildSteps.map((step, i) => ({
    // "Glue the cup to the box…" -> "Glue the cup to the box"
    title: step.split(/\s+/).slice(0, 6).join(" ").replace(/[.,;:!]+$/, "") || `Step ${i + 1}`,
    instruction: step.slice(0, 400),
    ingredients: req.ingredients.filter((name) => step.toLowerCase().includes(name.toLowerCase())),
    tools: [],
    tip: "",
    safety: CAREFUL_WORDS.test(step) ? ideaSafety || "Be careful here. Ask a grown-up to help." : "",
    minutes,
    difficulty: idea.difficulty,
    result: "", // the simple guide has no step pictures
  }));
}

// ---------- The overview (counted in code) ----------

function overviewOf(steps: GuideStep[], req: GuideRequest): GuideOverview {
  // Recipe order: the roles first, then the rest of the cauldron.
  const order = [...req.idea.roles.map((role) => role.ingredient), ...req.ingredients];
  const inOrder = (names: Set<string>) => order.filter((name, i) => names.has(name) && order.indexOf(name) === i);

  return {
    totalMinutes: steps.reduce((sum, step) => sum + step.minutes, 0),
    stepCount: steps.length,
    ingredients: inOrder(new Set(steps.flatMap((step) => step.ingredients))),
    tools: inOrder(new Set(steps.flatMap((step) => step.tools))),
    maxDifficulty: Math.max(1, ...steps.map((step) => step.difficulty)) as 1 | 2 | 3,
    safetySteps: steps.flatMap((step, i) => (step.safety ? [i + 1] : [])),
  };
}

// ---------- Asking Muse Spark (one retry) ----------

// One attempt: ask, then clean. null if the call failed or the answer wasn't usable JSON.
async function attempt(prompt: string, req: GuideRequest, label: string) {
  try {
    const reply = await askSpark(prompt);
    return { reply, guide: cleanGuide(reply, req) };
  } catch (err) {
    console.error(`guide: ${label} failed:`, err);
    return null;
  }
}

/**
 * Ask Muse Spark for the guide and check it in code. If it broke a rule (step count, an
 * ingredient or tool that isn't in the cauldron) or failed, ask once more, naming the broken
 * rules. The retry's answer is used if it has steps; otherwise the first answer. If neither
 * has any steps, the simple guide from the idea's own buildSteps is returned (fallback: true).
 */
async function writeGuide(req: GuideRequest): Promise<BuildGuide> {
  const prompt = buildPrompt(req);
  const first = await attempt(prompt, req, "first answer");
  let best = first?.guide ?? null;

  if (!first || first.guide.problems.length > 0) {
    const retryPrompt = first
      ? `${prompt}

Your previous answer was:
${first.reply}

It broke these rules:
- ${first.guide.problems.join("\n- ")}

Fix the problems and return the whole guide again, JSON only.`
      : prompt;
    const second = await attempt(retryPrompt, req, "retry");
    if (second && second.guide.steps.length > 0) best = second.guide;
    console.log(
      `guide: retried (${first ? `${first.guide.problems.length} broken rule(s)` : "first answer failed"}), ` +
        `retry ${second ? `gave ${second.guide.stepCountFromModel} steps, ${second.guide.problems.length} broken rule(s)` : "failed"}`
    );
  }

  if (best && best.steps.length > 0) {
    return { steps: best.steps, fallback: false, overview: overviewOf(best.steps, req) };
  }
  const steps = simpleGuide(req);
  if (steps.length === 0) throw new Error("No guide from Muse Spark and the idea has no build steps.");
  console.log(`guide: using the simple guide (${steps.length} steps)`);
  return { steps, fallback: true, overview: overviewOf(steps, req) };
}

// POST /api/guide — body: { idea: { title, description, materialsUsed, roles, buildSteps, safetyNote, timeMinutes, difficulty? }, ingredients }
export async function POST(request: Request) {
  const limited = checkRateLimit(request, "guide");
  if (limited) return limited;

  let req: GuideRequest | null;
  try {
    req = readGuideRequest(await request.json());
  } catch {
    req = null; // body wasn't valid JSON
  }
  if (!req) {
    return Response.json(
      { error: "Please send the idea (title, materials, steps, time) and the ingredients." },
      { status: 400 }
    );
  }

  try {
    return Response.json(await writeGuide(req));
  } catch (err) {
    // Details stay in the server log; the visitor gets a friendly message.
    console.error("guide failed:", err);
    return Response.json(
      { error: "Alchemia couldn't write the build guide right now. Please try again." },
      { status: 500 }
    );
  }
}
