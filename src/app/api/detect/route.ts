import { askSpark, parseJson } from "@/lib/meta";

// Shape of each object Muse Spark finds in the photo.
export type DetectedObject = {
  name: string;
  material: string;
  color: string;
};

const PROMPT = `Look at this photo and list each distinct physical object you can see.
Ignore people, and ignore the table, floor, wall or other background surfaces.
Return JSON only — no explanation, no markdown — as an array like:
[{"name": "short noun phrase", "material": "main material", "color": "main color"}]`;

// POST /api/detect  — body: { image: "data:image/jpeg;base64,..." }
export async function POST(request: Request) {
  try {
    const { image } = await request.json();
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return Response.json({ error: "Please send an image as a data URL." }, { status: 400 });
    }

    const reply = await askSpark(PROMPT, image);
    const objects = parseJson<DetectedObject[]>(reply);

    return Response.json({ objects });
  } catch (err) {
    console.error("detect failed:", err);
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  }
}
