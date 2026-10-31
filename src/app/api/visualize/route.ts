import { generateImage } from "@/lib/meta";

type VisualizeRequest = {
  idea: { title: string; description: string; materialsUsed: string[] };
  ingredients: string[];
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
  const { idea, ingredients } = body as Record<string, unknown>;
  if (typeof idea !== "object" || idea === null) return null;
  const { title, description, materialsUsed } = idea as Record<string, unknown>;

  const goodTitle = typeof title === "string" && title.trim() !== "" && title.length <= 120;
  const goodDescription = typeof description === "string" && description.length <= 500;

  if (!goodTitle || !goodDescription || !isStringList(materialsUsed) || !isStringList(ingredients)) {
    return null;
  }
  return { idea: { title, description, materialsUsed }, ingredients };
}

// The picture prompt is built in plain code, not by the LLM.
function buildImagePrompt({ title, description, materialsUsed }: VisualizeRequest["idea"]): string {
  return `A bright, friendly, realistic photo of a finished DIY project. ${title}: ${description}
It is made ONLY from these materials: ${materialsUsed.join(", ")}.
Shown on a simple tabletop. Nothing else added. No text, no logos, no people.`;
}

// POST /api/visualize — body: { idea: { title, description, materialsUsed }, ingredients }
export async function POST(request: Request) {
  let req: VisualizeRequest | null;
  try {
    req = readRequest(await request.json());
  } catch {
    req = null; // body wasn't valid JSON
  }
  if (!req) {
    return Response.json(
      { error: "Please send an idea (title, description, materialsUsed) and the ingredients." },
      { status: 400 }
    );
  }

  try {
    const image = await generateImage(buildImagePrompt(req.idea));
    return Response.json({ image });
  } catch (err) {
    console.error("visualize failed:", err);
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  }
}
