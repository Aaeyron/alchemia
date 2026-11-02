// Shared by the Muse Image routes (/api/visualize, /api/step-image): reading the materials,
// describing them for a prompt, and telling Meta's errors apart.
// Server only (it calls Muse Image through meta.ts).
import { editImage } from "@/lib/meta";
import type { MaterialInfo } from "@/lib/types";

const isShortText = (value: unknown) => typeof value === "string" && value.length <= 40;

// Optional list of { name, color?, material?, source }. Returns null if it's present but malformed.
export function readMaterials(value: unknown): MaterialInfo[] | null {
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

// "plastic bottle (blue, plastic), tape (no color given)" — falls back to plain names
// when the page didn't send material details.
export function describeMaterialList(materials: MaterialInfo[], names: string[]): string {
  if (materials.length === 0) return names.join(", ");
  return materials
    .map(({ name, color, material }) => {
      const details = [color ?? "no color given", material].filter(Boolean).join(", ");
      return `${name} (${details})`;
    })
    .join(", ");
}

// The HTTP status in our meta.ts errors ("Muse Image edit failed (400): ..."), if any.
export function upstreamStatus(err: unknown): number | null {
  const match = err instanceof Error ? err.message.match(/\((\d{3})\)/) : null;
  return match ? Number(match[1]) : null;
}

// Meta's content filter rejected the prompt (a 400 with this code).
export function isContentPolicy(err: unknown): boolean {
  return err instanceof Error && err.message.includes("content_policy_violation");
}

// Worth one more try: the network failed (fetch throws a TypeError) or Meta had a 5xx error.
export function isTemporary(err: unknown): boolean {
  const status = upstreamStatus(err);
  return err instanceof TypeError || (status !== null && status >= 500);
}

// ---------- One edit with the plain-prompt fallback ----------

const RETRY_DELAY_MS = 1500;

// One /images/edits call, retried once after a short delay on network errors or 5xx (never on 4xx).
// Logs `label`, the result, the status and the time. Never the image data.
async function editWithRetry(prompt: string, images: string[], label: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    try {
      const image = await editImage(prompt, images);
      console.log(`${label} ok in ${Date.now() - started} ms, status 200`);
      return image;
    } catch (err) {
      console.error(`${label} failed in ${Date.now() - started} ms, status ${upstreamStatus(err) ?? "none"}:`, err);
      if (attempt === 1 && isTemporary(err)) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Paint with the full prompt. If Meta's content filter blocks it, try once more with the
 * plain prompt (no text Muse Spark wrote, such as titles and roles), like /api/visualize does.
 * `label` names the request in the logs, e.g. "step-image: step 2/5".
 */
export async function editWithPlainFallback(
  prompts: { full: string; plain: string },
  images: string[],
  label: string
): Promise<string> {
  try {
    return await editWithRetry(prompts.full, images, `${label} (full prompt)`);
  } catch (err) {
    if (!isContentPolicy(err)) throw err;
    return editWithRetry(prompts.plain, images, `${label} (plain prompt)`);
  }
}
