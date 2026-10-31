import { askSpark, parseJson } from "@/lib/meta";
import type { VoiceIntent } from "@/lib/types";

type Intent = VoiceIntent["intent"];
const INTENTS: Intent[] = ["set_goal", "add_items", "missing", "weird", "easier", "none"];

const BUDGETS = [0, 50, 100, 500]; // pesos, same as the budget chips
const TIMES = [5, 10, 30, 60]; // minutes, same as the time chips

type VoiceRequest = {
  text: string;
  ingredients: string[];
  goalSet: boolean;
  ideaMaterials: string[];
};

// A list of short strings (may be empty).
function isShortList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 30 &&
    value.every((item) => typeof item === "string" && item.length <= 80)
  );
}

// Check the request body. Returns null if anything is missing or the wrong type.
function readRequest(body: unknown): VoiceRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { text, ingredients, goalSet, ideaMaterials = [] } = body as Record<string, unknown>;

  const goodText = typeof text === "string" && text.trim() !== "" && text.length <= 500;
  if (!goodText || !isShortList(ingredients) || typeof goalSet !== "boolean" || !isShortList(ideaMaterials)) {
    return null;
  }
  return { text: text.trim(), ingredients, goalSet, ideaMaterials };
}

function buildPrompt({ text, ingredients, goalSet, ideaMaterials }: VoiceRequest): string {
  return `You turn what a student said to Alchemia (a friendly DIY invention helper) into one command.
The student may speak English, Tagalog, Bisaya (Cebuano) or a mix like Taglish.

What they said: ${JSON.stringify(text)}
Their ingredients: ${ingredients.length > 0 ? ingredients.join(", ") : "none yet"}
Materials of the idea on screen: ${ideaMaterials.length > 0 ? ideaMaterials.join(", ") : "none"}
A goal is already set: ${goalSet ? "yes" : "no"}

Pick ONE intent:
- "set_goal": they say what they need or want to make, maybe with a budget or a time.
  Examples: "I need something to hold my pens, 10 minutes, no money",
  "kailangan ko ng lalagyan ng lapis, ₱0 lang", "kinahanglan nako ug butanganan sa lapis".
  goal = a short English phrase (e.g. "something to hold pens").
  budgetPhp = pesos if they said a budget ("no money", "libre", "walang pera", "wala koy kwarta" = 0).
  timeMinutes = minutes if they said a time.
- "add_items": they say they have more things.
  Examples: "I also have scissors", "meron akong tape", "naa koy gunting".
  items = short English noun phrases (e.g. "scissors").
- "missing": they don't have something.
  Examples: "I don't have string", "wala akong string", "wala koy tali".
  items = copied EXACTLY from the idea materials list (or the ingredients) when they match.
- "weird": "make it weird", "gawin mong kakaiba", "himoa nga weird".
- "easier": "make it easier", "gawin mong mas madali", "himoa nga mas sayon".
- "none": anything else.

Return JSON only — no explanation, no markdown — like:
{"intent": "set_goal", "goal": "something to hold pens", "budgetPhp": 0, "timeMinutes": 10}
Leave out fields that don't apply.`;
}

// The option closest to the value (ties go to the smaller one).
function nearest(value: number, options: number[]): number {
  return options.reduce((best, option) => (Math.abs(option - value) < Math.abs(best - value) ? option : best));
}

// Trim, shorten and drop empty / duplicate items.
function cleanItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 40))
    .filter((item) => item !== "");
  return [...new Set(items)].slice(0, 10);
}

// Snap each item to the exact name in `candidates` (exact match first, then one name
// containing the other). Items that match nothing are dropped.
function snapToNames(items: string[], candidates: string[]): string[] {
  const snapped = items
    .map((item) => {
      const lower = item.toLowerCase();
      return (
        candidates.find((name) => name.toLowerCase() === lower) ??
        candidates.find((name) => name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase()))
      );
    })
    .filter((name): name is string => name !== undefined);
  return [...new Set(snapped)];
}

// Turn the model's raw answer into a safe, tidy command.
function cleanIntent(raw: Partial<Record<keyof VoiceIntent, unknown>>, req: VoiceRequest): VoiceIntent {
  const intent: Intent = INTENTS.includes(raw.intent as Intent) ? (raw.intent as Intent) : "none";

  if (intent === "set_goal") {
    const goal = typeof raw.goal === "string" ? raw.goal.trim().slice(0, 200) : "";
    if (goal === "") return { intent: "none" };
    const result: VoiceIntent = { intent, goal };
    const budget = Number(raw.budgetPhp);
    const time = Number(raw.timeMinutes);
    if (raw.budgetPhp !== undefined && raw.budgetPhp !== null && Number.isFinite(budget) && budget >= 0) {
      result.budgetPhp = nearest(budget, BUDGETS);
    }
    if (raw.timeMinutes !== undefined && raw.timeMinutes !== null && Number.isFinite(time) && time > 0) {
      result.timeMinutes = nearest(time, TIMES);
    }
    return result;
  }

  if (intent === "add_items") {
    const items = cleanItems(raw.items);
    return items.length > 0 ? { intent, items } : { intent: "none" };
  }

  if (intent === "missing") {
    const candidates = req.ideaMaterials.length > 0 ? req.ideaMaterials : req.ingredients;
    const items = snapToNames(cleanItems(raw.items), candidates);
    return items.length > 0 ? { intent, items } : { intent: "none" };
  }

  return { intent };
}

// POST /api/voice-intent — body: { text, ingredients, goalSet, ideaMaterials? }
export async function POST(request: Request) {
  let req: VoiceRequest | null;
  try {
    req = readRequest(await request.json());
  } catch {
    req = null; // body wasn't valid JSON
  }
  if (!req) {
    return Response.json(
      { error: "Please send the text, the ingredient names and whether a goal is set." },
      { status: 400 }
    );
  }

  try {
    const raw = parseJson<Partial<Record<keyof VoiceIntent, unknown>>>(await askSpark(buildPrompt(req)));
    const command = cleanIntent(typeof raw === "object" && raw !== null ? raw : {}, req);
    return Response.json(command);
  } catch (err) {
    console.error("voice-intent failed:", err);
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  }
}
