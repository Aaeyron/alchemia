// Server-only helpers for talking to Meta's Muse Spark model.
// The "server-only" import makes the build fail if a client component ever imports this file,
// so the API key can never leak to the browser.
import "server-only";

const API_KEY = process.env.MODEL_API_KEY;
const BASE_URL = process.env.MODEL_API_BASE_URL || "https://api.meta.ai/v1";
const MODEL = process.env.MODEL_API_MODEL || "muse-spark-1.3";
const IMAGE_MODEL = process.env.MODEL_API_IMAGE_MODEL || "muse-image-1.0";

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
