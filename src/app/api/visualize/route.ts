import { editImage, generateImage } from "@/lib/meta";

const MAX_PHOTOS = 3;

type VisualizeRequest = {
  idea: { title: string; description: string; materialsUsed: string[] };
  ingredients: string[];
  photos: string[]; // the user's downscaled photos (data URLs), may be empty
  typedOnly: string[]; // typed materials not seen in any photo, may be empty
};

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
  const { idea, ingredients, photos = [], typedOnly = [] } = body as Record<string, unknown>;
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
    !goodTypedOnly
  ) {
    return null;
  }
  return {
    idea: { title, description, materialsUsed },
    ingredients,
    photos: photos as string[],
    typedOnly: typedOnly as string[],
  };
}

// Text-only picture prompt (used when there are no photos, or the edit fails).
function buildImagePrompt({ title, description, materialsUsed }: VisualizeRequest["idea"]): string {
  return `A bright, friendly, realistic photo of a finished DIY project. ${title}: ${description}
It is made ONLY from these materials: ${materialsUsed.join(", ")}.
Shown on a simple tabletop. Nothing else added. No text, no logos, no people.`;
}

// Edit prompt: start from the user's real photo(s).
function buildEditPrompt({ idea, typedOnly }: VisualizeRequest): string {
  const typedLine =
    typedOnly.length > 0
      ? `These items are not in the photos; show them only if the project needs them: ${typedOnly.join(", ")}.`
      : "";
  return `Using these photos, transform ONLY these materials into the finished project: ${idea.materialsUsed.join(", ")}.
The finished project is "${idea.title}": ${idea.description}
Keep the same tabletop and lighting. Add nothing else. ${typedLine}
A bright, friendly, realistic photo. No text, no logos, no people.`;
}

// POST /api/visualize — body: { idea: { title, description, materialsUsed }, ingredients, photos?, typedOnly? }
export async function POST(request: Request) {
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

    const image = await generateImage(buildImagePrompt(req.idea));
    console.log("visualize: used /images/generations");
    return Response.json({ image });
  } catch (err) {
    console.error("visualize failed:", err);
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  }
}
