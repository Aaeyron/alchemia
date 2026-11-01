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
  return `A bright, friendly, realistic photo of a finished DIY project. ${title}: ${description}
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
The finished project is "${idea.title}": ${idea.description}${roleLines(req)}
${typedLine}A bright, friendly, realistic photo.
${colorRules(req, true)}`;
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
    if (req.photos.length > 0) {
      try {
        const image = await editImage(buildEditPrompt(req), req.photos);
        console.log(`visualize: used /images/edits with ${req.photos.length} photo(s)`);
        return Response.json({ image });
      } catch (err) {
        console.error("visualize: /images/edits failed, falling back to /images/generations:", err);
      }
    }

    const image = await generateImage(buildImagePrompt(req));
    console.log("visualize: used /images/generations");
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
