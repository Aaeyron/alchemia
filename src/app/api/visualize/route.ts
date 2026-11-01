import { editImage, generateImage } from "@/lib/meta";
import { checkRateLimit } from "@/lib/rateLimit";
import type { IngredientRole, MaterialInfo } from "@/lib/types";

// Vercel Hobby allows up to 300 s per function (the plan's maximum).
// This is the slowest route: an image edit, and possibly a text-to-image fallback after it.
export const maxDuration = 300;

const MAX_PHOTOS = 3;

type VisualizeRequest = {
  idea: { title: string; description: string; materialsUsed: string[] };
  ingredients: string[];
  photos: string[]; // the user's downscaled photos (data URLs), may be empty
  typedOnly: string[]; // typed materials not seen in any photo, may be empty
  materials: MaterialInfo[]; // the idea's materials with known colors; may be empty (older callers)
  roles: IngredientRole[]; // what each ingredient becomes in the project; may be empty (older callers)
};

const isShortText = (value: unknown) => typeof value === "string" && value.length <= 40;

// Optional list of { ingredient, role }. Returns null if it's present but malformed.
function readRoles(value: unknown): IngredientRole[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) return null;
  const roles: IngredientRole[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const { ingredient, role } = item as Record<string, unknown>;
    const good =
      typeof ingredient === "string" &&
      ingredient.trim() !== "" &&
      ingredient.length <= 80 &&
      typeof role === "string" &&
      role.trim() !== "" &&
      role.length <= 80;
    if (!good) return null;
    roles.push({ ingredient: ingredient.trim(), role: role.trim() });
  }
  return roles;
}

// Optional list of { name, color?, material?, source }. Returns null if it's present but malformed.
function readMaterials(value: unknown): MaterialInfo[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) return null;
  const materials: MaterialInfo[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const { name, color, material, source } = item as Record<string, unknown>;
    const good =
      typeof name === "string" &&
      name.trim() !== "" &&
      name.length <= 80 &&
      (color === undefined || isShortText(color)) &&
      (material === undefined || isShortText(material)) &&
      (source === "photo" || source === "typed");
    if (!good) return null;
    materials.push({
      name,
      color: (color as string | undefined)?.trim() || undefined,
      material: (material as string | undefined)?.trim() || undefined,
      source,
    });
  }
  return materials;
}

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 30 &&
    value.every((item) => typeof item === "string" && item.trim() !== "")
  );
}

// Check the request body. Returns null if anything is missing or the wrong type.
function readRequest(body: unknown): VisualizeRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const {
    idea,
    ingredients,
    photos = [],
    typedOnly = [],
    materials: rawMaterials,
    roles: rawRoles,
  } = body as Record<string, unknown>;
  const materials = readMaterials(rawMaterials);
  const roles = readRoles(rawRoles);
  if (typeof idea !== "object" || idea === null) return null;
  const { title, description, materialsUsed } = idea as Record<string, unknown>;

  const goodTitle = typeof title === "string" && title.trim() !== "" && title.length <= 120;
  const goodDescription = typeof description === "string" && description.length <= 500;
  const goodPhotos =
    Array.isArray(photos) &&
    photos.length <= MAX_PHOTOS &&
    photos.every((photo) => typeof photo === "string" && photo.startsWith("data:image/"));
  const goodTypedOnly = Array.isArray(typedOnly) && (typedOnly.length === 0 || isStringList(typedOnly));

  if (
    !goodTitle ||
    !goodDescription ||
    !isStringList(materialsUsed) ||
    !isStringList(ingredients) ||
    !goodPhotos ||
    !goodTypedOnly ||
    !materials ||
    !roles
  ) {
    return null;
  }
  return {
    idea: { title, description, materialsUsed },
    ingredients,
    photos: photos as string[],
    typedOnly: typedOnly as string[],
    materials,
    roles,
  };
}

// "Show each ingredient in its role: tape is the handle; plastic bottle is the pen cup.
// Show no other objects." Empty when the page sent no roles (the prompts stay as before).
function roleLines({ roles }: VisualizeRequest): string {
  if (roles.length === 0) return "";
  const list = roles.map(({ ingredient, role }) => `${ingredient} is ${role}`).join("; ");
  return `\nShow each ingredient in its role: ${list}.\nShow no other objects.`;
}

// "plastic bottle (blue, plastic), tape (no color given)" — falls back to plain names
// when the page didn't send material details.
function describeMaterials({ idea, materials }: VisualizeRequest): string {
  if (materials.length === 0) return idea.materialsUsed.join(", ");
  return materials
    .map(({ name, color, material }) => {
      const details = [color ?? "no color given", material].filter(Boolean).join(", ");
      return `${name} (${details})`;
    })
    .join(", ");
}

// Color rules shared by both prompts. `fromPhotos` = the picture starts from the user's photos.
function colorRules({ materials }: VisualizeRequest, fromPhotos: boolean): string {
  const examples = materials
    .filter((m) => m.color)
    .slice(0, 3)
    .map((m) => `the ${m.name} stays ${m.color}`);
  const exampleText = examples.length > 0 ? ` (for example: ${examples.join(", ")})` : "";
  const setting = fromPhotos
    ? "Keep the same tabletop, background and lighting as the photos."
    : "Show it on a simple tabletop with soft, natural lighting.";

  return `Rules:
- Each material keeps its real color and surface exactly as it is${fromPhotos ? " in the photos" : ""}${exampleText}.
- Do not recolor, paint, dye or decorate anything, and add no patterns, stickers or glitter,
  unless the project uses a listed item for that purpose.
- For items with no color given, use the plain, natural color of that kind of material
  (for example clear or beige tape), never a bright invented color.
- ${setting}
- Add nothing that is not in the materials list. No text, no logos, no people.`;
}

// Text-only picture prompt (used when there are no photos, or the edit fails).
function buildImagePrompt(req: VisualizeRequest): string {
  const { title, description } = req.idea;
  return `A bright, friendly, realistic photo of a finished DIY project. ${title}${description ? `: ${description}` : "."}
It is made ONLY from these materials: ${describeMaterials(req)}.${roleLines(req)}
${colorRules(req, false)}`;
}

// Edit prompt: start from the user's real photo(s).
function buildEditPrompt(req: VisualizeRequest): string {
  const { idea, typedOnly } = req;
  const typedLine =
    typedOnly.length > 0
      ? `These items are not in the photos; show them only if the project needs them: ${typedOnly.join(", ")}.\n`
      : "";
  return `Using these photos, transform ONLY these materials into the finished project: ${describeMaterials(req)}.
The finished project is "${idea.title}"${idea.description ? `: ${idea.description}` : "."}${roleLines(req)}
${typedLine}A bright, friendly, realistic photo.
${colorRules(req, true)}`;
}

// ---------- Calling Muse Image: retry, content filter, logging ----------

type Endpoint = "edits" | "generations";

const RETRY_DELAY_MS = 1500;
const DEADLINE_MS = 200_000; // stop trying new attempts after this, to stay under maxDuration

// The HTTP status in our meta.ts errors ("Muse Image edit failed (400): ..."), if any.
function upstreamStatus(err: unknown): number | null {
  const match = err instanceof Error ? err.message.match(/\((\d{3})\)/) : null;
  return match ? Number(match[1]) : null;
}

// Meta's content filter rejected the prompt (a 400 with this code).
function isContentPolicy(err: unknown): boolean {
  return err instanceof Error && err.message.includes("content_policy_violation");
}

// Worth one more try: the network failed (fetch throws a TypeError) or Meta had a 5xx error.
function isTemporary(err: unknown): boolean {
  const status = upstreamStatus(err);
  return err instanceof TypeError || (status !== null && status >= 500);
}

// The same request without the text Muse Spark wrote (title, description, roles), which is what
// tripped the content filter after a tweak. Only the ingredients and the house rules remain.
function withoutIdeaText(req: VisualizeRequest): VisualizeRequest {
  return { ...req, idea: { ...req.idea, title: "a simple DIY craft project", description: "" }, roles: [] };
}

// "2 photos: 212 KB, 187 KB" — sizes only, never the photo data.
function describePhotos(photos: string[]): string {
  const sizes = photos.map((photo) => `${Math.round((photo.length * 3) / 4 / 1024)} KB`);
  return `${photos.length} photo(s)${sizes.length > 0 ? `: ${sizes.join(", ")}` : ""}`;
}

// One call to Muse Image, retried once after a short delay on network errors or 5xx (never on 4xx).
// Logs the endpoint, result, status and duration on the server.
async function callImage(endpoint: Endpoint, req: VisualizeRequest, label: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    try {
      const image =
        endpoint === "edits"
          ? await editImage(buildEditPrompt(req), req.photos)
          : await generateImage(buildImagePrompt(req));
      console.log(
        `visualize: /images/${endpoint} (${label}) ok in ${Date.now() - started} ms` +
          (endpoint === "edits" ? `, ${describePhotos(req.photos)}` : "")
      );
      return image;
    } catch (err) {
      console.error(
        `visualize: /images/${endpoint} (${label}) failed in ${Date.now() - started} ms, ` +
          `status ${upstreamStatus(err) ?? "none"}` +
          (endpoint === "edits" ? `, ${describePhotos(req.photos)}` : "") +
          ":",
        err
      );
      if (attempt === 1 && isTemporary(err)) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Paint the picture. Tries, in order (skipping what doesn't apply):
 * 1. /images/edits from the user's photos, with the full prompt,
 * 2. if Meta's content filter blocked the prompt: /images/edits without the idea's text,
 * 3. /images/generations (text only), with the full prompt, or without the idea's text
 *    if the filter already blocked it.
 */
async function paint(req: VisualizeRequest): Promise<string> {
  const started = Date.now();
  const endpoints: Endpoint[] = req.photos.length > 0 ? ["edits", "generations"] : ["generations"];
  let blocked = false; // the content filter rejected the full prompt
  let lastError: unknown = new Error("No picture attempt was made.");

  for (const endpoint of endpoints) {
    for (const plain of [false, true]) {
      if (plain !== blocked) continue; // full prompt until it's blocked, then only the plain one
      if (Date.now() - started > DEADLINE_MS) throw lastError;
      try {
        return await callImage(endpoint, plain ? withoutIdeaText(req) : req, plain ? "plain prompt" : "full prompt");
      } catch (err) {
        lastError = err;
        if (isContentPolicy(err) && !blocked) {
          blocked = true;
          // Development only: show the blocked prompt, to find the words that trip the filter.
          if (process.env.NODE_ENV !== "production") {
            console.error("visualize: blocked prompt was:\n" + (endpoint === "edits" ? buildEditPrompt(req) : buildImagePrompt(req)));
          }
        }
      }
    }
  }
  throw lastError;
}

// POST /api/visualize — body: { idea: { title, description, materialsUsed }, ingredients, photos?, typedOnly?, materials?, roles? }
export async function POST(request: Request) {
  const limited = checkRateLimit(request, "visualize");
  if (limited) return limited;

  let req: VisualizeRequest | null;
  try {
    req = readRequest(await request.json());
  } catch {
    req = null; // body wasn't valid JSON
  }
  if (!req) {
    return Response.json(
      { error: "Please send an idea (title, description, materialsUsed), the ingredients, and at most 3 photos." },
      { status: 400 }
    );
  }

  try {
    // Prefer starting from the user's real photos; fall back to a picture from text alone.
    const image = await paint(req);
    return Response.json({ image });
  } catch (err) {
    // Details stay in the server log; the visitor gets a friendly message.
    console.error("visualize failed:", err);
    return Response.json(
      { error: "Alchemia couldn't paint the picture right now. Please try again." },
      { status: 500 }
    );
  }
}
