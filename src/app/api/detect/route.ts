import { askSpark, parseJson } from "@/lib/meta";
import { checkRateLimit } from "@/lib/rateLimit";

// Vercel Hobby allows up to 300 s per function (the plan's maximum).
export const maxDuration = 300;

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
  const limited = checkRateLimit(request, "detect");
  if (limited) return limited;

  try {
    const { image } = await request.json();
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return Response.json({ error: "Please send an image as a data URL." }, { status: 400 });
    }

    const reply = await askSpark(PROMPT, image);
    const objects = parseJson<DetectedObject[]>(reply);

    return Response.json({ objects });
  } catch (err) {
    // Details stay in the server log; the visitor gets a friendly message.
    console.error("detect failed:", err);
    return Response.json(
      { error: "Alchemia couldn't look at that photo right now. Please try again." },
      { status: 500 }
    );
  }
}
