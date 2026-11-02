import { describeMaterialList, editWithPlainFallback, readMaterials } from "@/lib/imageRules";
import { checkRateLimit } from "@/lib/rateLimit";
import type { MaterialInfo } from "@/lib/types";

// Vercel Hobby allows up to 300 s per function (the plan's maximum).
// One image edit, possibly retried (5xx/network) and possibly repeated with the plain prompt.
export const maxDuration = 300;

const MAX_PICTURE_CHARS = 4_000_000; // like api.ts: stay under Vercel's ~4.5 MB request limit
const MAX_STEPS = 8; // the guide has 3 to 8 steps

type StepImageRequest = {
  picture: string; // the concept picture (downscaled data URL, or an https URL)
  photo: string | null; // the student's first photo, for the real colors (optional)
  step: { title: string; result: string; ingredients: string[] };
  stepNumber: number; // from 1
  totalSteps: number;
  materials: MaterialInfo[]; // every ingredient used in steps 1..stepNumber, with colors
  title: string; // the idea's title
};

const isPicture = (value: unknown, allowUrl: boolean): value is string =>
  typeof value === "string" &&
  value.length <= MAX_PICTURE_CHARS &&
  (value.startsWith("data:image/") || (allowUrl && value.startsWith("https://")));

const isWholeNumber = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

// Check the request body. Returns null if anything is missing or the wrong type.
function readRequest(body: unknown): StepImageRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { picture, photo, step, stepNumber, totalSteps, materials: rawMaterials, title } = body as Record<string, unknown>;
  const materials = readMaterials(rawMaterials);
  if (typeof step !== "object" || step === null) return null;
  const { title: stepTitle, result, ingredients = [] } = step as Record<string, unknown>;

  const good =
    isPicture(picture, true) &&
    (photo === undefined || photo === null || isPicture(photo, false)) &&
    typeof title === "string" &&
    title.trim() !== "" &&
    title.length <= 500 &&
    typeof stepTitle === "string" &&
    stepTitle.length <= 500 &&
    typeof result === "string" &&
    result.trim() !== "" &&
    result.length <= 1000 &&
    Array.isArray(ingredients) &&
    ingredients.length <= 30 &&
    ingredients.every((name) => typeof name === "string" && name.length <= 80) &&
    isWholeNumber(totalSteps, 1, MAX_STEPS) &&
    isWholeNumber(stepNumber, 1, totalSteps);
  if (!good || !materials) return null;

  return {
    picture,
    photo: typeof photo === "string" ? photo : null,
    step: {
      title: stepTitle.trim().slice(0, 60),
      result: result.trim().slice(0, 200),
      ingredients: (ingredients as string[]).map((name) => name.trim()).filter(Boolean),
    },
    stepNumber,
    totalSteps,
    materials,
    title: title.trim().slice(0, 120),
  };
}

// ---------- The prompt ----------

// Words about people or body parts. A sentence that has one is left out of the picture prompt,
// so the prompt never asks for people (the picture shows only the object).
const PEOPLE_WORDS =
  /\b(person|people|someone|somebody|man|men|woman|women|boy|boys|girl|girls|child|children|kid|kids|student|students|adult|adults|grown-?up|grown-?ups|you|your|hand|hands|finger|fingers|thumb|thumbs|arm|arms|face|faces|head|eye|eyes|body|leg|legs|foot|feet|skin|nail|nails)\b/i;

// "The cup sits on the base. Hold it with your hands." -> "The cup sits on the base."
function withoutPeople(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !PEOPLE_WORDS.test(sentence))
    .join(" ")
    .trim();
}

// What the picture should show. If every sentence of "result" mentioned people, the step's
// title is used instead (if it's free of people too), else a neutral description.
function describeStep({ step }: StepImageRequest): string {
  return withoutPeople(step.result) || withoutPeople(step.title) || "the project, partly built";
}

function materialsText(req: StepImageRequest): string {
  return describeMaterialList(req.materials, req.step.ingredients);
}

// The last rules of both prompts. The second reference picture (the photo) is explained if sent.
function houseRules(req: StepImageRequest): string {
  const photoLine = req.photo
    ? "\nThe first reference picture is the finished concept; the second is the student's real ingredients, for their true colors."
    : "";
  return `Same tabletop, lighting and camera angle as the reference.
Show only the object and the ingredients. No people, no hands, no text, no logos. Do not add anything that is not listed.${photoLine}`;
}

function buildFullPrompt(req: StepImageRequest): string {
  const isLast = req.stepNumber === req.totalSteps;
  const stateLine = isLast
    ? "This is the finished object, exactly as it looks in the reference picture."
    : "This is a partly finished version of the object in the reference picture.";
  return `Show a progress photo of the project "${req.title}" at step ${req.stepNumber} of ${req.totalSteps}: ${describeStep(req)}
${stateLine}
Use only these ingredients, keeping their real colors: ${materialsText(req)}.
${houseRules(req)}`;
}

// Used once if the content filter blocks the full prompt: no title (text Muse Spark wrote),
// only the step's result and the materials.
function buildPlainPrompt(req: StepImageRequest): string {
  return `Show a progress photo of a partly finished DIY craft project: ${describeStep(req)}
Use only these ingredients, keeping their real colors: ${materialsText(req)}.
${houseRules(req)}`;
}

// POST /api/step-image — body: { picture, photo?, step: { title, result, ingredients }, stepNumber, totalSteps, materials?, title }
export async function POST(request: Request) {
  const limited = checkRateLimit(request, "step-image");
  if (limited) return limited;

  let req: StepImageRequest | null;
  try {
    req = readRequest(await request.json());
  } catch {
    req = null; // body wasn't valid JSON
  }
  if (!req) {
    return Response.json(
      { error: "Please send the concept picture, the step (title and result), its number and the idea's title." },
      { status: 400 }
    );
  }

  try {
    const images = req.photo ? [req.picture, req.photo] : [req.picture];
    const image = await editWithPlainFallback(
      { full: buildFullPrompt(req), plain: buildPlainPrompt(req) },
      images,
      `step-image: step ${req.stepNumber}/${req.totalSteps}`
    );
    return Response.json({ image });
  } catch (err) {
    // Details stay in the server log; the visitor gets a friendly message.
    console.error("step-image failed:", err);
    return Response.json({ error: "Alchemia couldn't paint this step right now. Please try again." }, { status: 500 });
  }
}
