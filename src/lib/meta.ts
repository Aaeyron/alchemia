// Server-only helpers for talking to Meta's Muse Spark model.
// The "server-only" import makes the build fail if a client component ever imports this file,
// so the API key can never leak to the browser.
import "server-only";

const API_KEY = process.env.MODEL_API_KEY;
const BASE_URL = process.env.MODEL_API_BASE_URL || "https://api.meta.ai/v1";
const MODEL = process.env.MODEL_API_MODEL || "muse-spark-1.3";
const IMAGE_MODEL = process.env.MODEL_API_IMAGE_MODEL || "muse-image-1.0";
const SAM_MODEL = process.env.MODEL_API_SAM_MODEL || "sam-3.1";

// One piece of a chat message: either text or an image (OpenAI-compatible format).
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/**
 * Send a prompt (and optionally an image as a data URL) to Muse Spark
 * and return the model's text reply.
 */
export async function askSpark(prompt: string, imageDataUrl?: string): Promise<string> {
  if (!API_KEY) {
    throw new Error("MODEL_API_KEY is not set. Add it to .env.local and restart the dev server.");
  }

  const content: ContentPart[] = [{ type: "text", text: prompt }];
  if (imageDataUrl) {
    content.push({ type: "image_url", image_url: { url: imageDataUrl } });
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Muse Spark request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== "string") {
    throw new Error("Muse Spark returned an unexpected response shape.");
  }
  return reply;
}

/**
 * Generate one picture from a text prompt with Muse Image (POST /images/generations).
 * Returns something an <img> can show: a data URL (the default base64 response)
 * or a temporary URL if the API sends one instead.
 */
export async function generateImage(prompt: string): Promise<string> {
  if (!API_KEY) {
    throw new Error("MODEL_API_KEY is not set. Add it to .env.local and restart the dev server.");
  }

  const res = await fetch(`${BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt, n: 1 }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Muse Image request failed (${res.status}): ${body}`);
  }

  // Documented response: { data: [{ b64_json } or { url }], output_format: "webp" | "png" | "jpeg", ... }
  const data = await res.json();
  const image = data?.data?.[0];
  if (typeof image?.b64_json === "string") {
    const format = data.output_format || "webp";
    return `data:image/${format};base64,${image.b64_json}`;
  }
  if (typeof image?.url === "string") {
    return image.url;
  }
  throw new Error("Muse Image returned an unexpected response shape.");
}

// One box SAM found, in source-image pixels (corners are inclusive), plus the image size.
export type SamBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  imageWidth: number;
  imageHeight: number;
  score: number; // 0 to 1
};

/**
 * Find every instance of ONE short noun phrase (e.g. "plastic bottle") in an image
 * with SAM 3.1 (POST /responses). SAM takes one phrase per request.
 *
 * The documented answer is a server-sent-event stream. Each "response.output_text.delta"
 * event carries a piece of text like:
 *   <0f>0<|box;x1=353;y1=382;x2=453;y2=427;w=537;h=561;c=0.93|><|mask;...|>,1<|box;...|>...
 * We join the pieces and read only the box tokens (masks are ignored).
 * No match is not an error: the text is simply empty and we return [].
 */
export async function segmentImage(imageDataUrl: string, phrase: string): Promise<SamBox[]> {
  if (!API_KEY) {
    throw new Error("MODEL_API_KEY is not set. Add it to .env.local and restart the dev server.");
  }

  const res = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: SAM_MODEL,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: phrase },
            { type: "input_image", image_url: imageDataUrl },
          ],
        },
      ],
      metadata: { include_confidence: "true" }, // adds a score "c" to each box
      stream: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SAM request failed (${res.status}): ${body}`);
  }

  // Collect the text from every "data: {...}" line of the event stream.
  let text = "";
  for (const line of (await res.text()).split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice("data: ".length).trim();
    if (payload === "[DONE]") break;
    try {
      const event = JSON.parse(payload);
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        text += event.delta;
      }
    } catch {
      // not JSON (e.g. a keep-alive line); skip it
    }
  }

  // Read each <|box;key=value;...|> token.
  const boxes: SamBox[] = [];
  for (const match of text.matchAll(/<\|box;([^|]*)\|>/g)) {
    const fields = Object.fromEntries(
      match[1].split(";").map((pair) => {
        const [key, value] = pair.split("=");
        return [key, Number(value)];
      })
    );
    const { x1, y1, x2, y2, w, h, c } = fields;
    if ([x1, y1, x2, y2, w, h].every(Number.isFinite) && w > 0 && h > 0) {
      boxes.push({ x1, y1, x2, y2, imageWidth: w, imageHeight: h, score: Number.isFinite(c) ? c : 0 });
    }
  }
  return boxes;
}

/**
 * Parse JSON from a model reply. Models often wrap JSON in ```json ... ``` fences,
 * so we strip those before parsing.
 */
export function parseJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
