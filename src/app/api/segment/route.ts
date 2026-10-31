import { segmentImage, type SamBox } from "@/lib/meta";
import type { PhotoBox } from "@/lib/types";

const MAX_NAMES = 8;

type SegmentRequest = { image: string; names: string[] };

// Check the request body. Returns null if anything is missing or the wrong type.
function readRequest(body: unknown): SegmentRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { image, names } = body as Record<string, unknown>;

  const goodImage = typeof image === "string" && image.startsWith("data:image/");
  const goodNames =
    Array.isArray(names) &&
    names.length > 0 &&
    names.length <= MAX_NAMES &&
    names.every((name) => typeof name === "string" && name.trim() !== "" && name.length <= 80);

  if (!goodImage || !goodNames) return null;
  return { image, names };
}

// SAM wants one short noun phrase; commas, semicolons and "+" make it return nothing.
function toPhrase(name: string): string {
  return name.replace(/[,;+]/g, " ").replace(/\s+/g, " ").trim();
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

// Pixel corners (inclusive) -> fractions of the image size, so the UI can place it at any size.
function toFractions(name: string, box: SamBox): PhotoBox {
  const x = clamp(box.x1 / box.imageWidth);
  const y = clamp(box.y1 / box.imageHeight);
  return {
    name,
    x,
    y,
    w: clamp((box.x2 - box.x1 + 1) / box.imageWidth),
    h: clamp((box.y2 - box.y1 + 1) / box.imageHeight),
    score: box.score,
  };
}

// POST /api/segment — body: { image: "data:image/jpeg;base64,...", names: ["mug", ...] }
export async function POST(request: Request) {
  let req: SegmentRequest | null;
  try {
    req = readRequest(await request.json());
  } catch {
    req = null; // body wasn't valid JSON
  }
  if (!req) {
    return Response.json({ error: "Please send an image data URL and 1 to 8 object names." }, { status: 400 });
  }
  const { image, names } = req;

  // SAM takes one phrase per request, so ask about every name at the same time.
  const results = await Promise.allSettled(names.map((name) => segmentImage(image, toPhrase(name))));

  const boxes: PhotoBox[] = [];
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`segment failed for "${names[i]}":`, result.reason);
      return;
    }
    // Keep only the best-scoring box for each name; names with no box are left out.
    const best = result.value.reduce<SamBox | null>((top, box) => (!top || box.score > top.score ? box : top), null);
    if (best) boxes.push(toFractions(names[i], best));
  });

  // Even if every call failed, answer 200 with what we have: the chips still work without boxes.
  return Response.json({ boxes });
}
