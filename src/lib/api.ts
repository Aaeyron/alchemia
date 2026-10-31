// Browser helpers for calling our own API routes with friendly errors.
// Our routes answer { error: "<friendly message>" } on failure. Vercel itself can also answer
// (e.g. 413 "too large" or 504 "timeout") with a body that isn't JSON; we turn those into
// friendly messages too, so the "Oops!" box never shows technical text.

// Vercel Functions accept request bodies up to about 4.5 MB; stay safely below that.
const MAX_BODY_CHARS = 4_000_000;

export const TOO_LARGE_MESSAGE = "That's a bit too big to send. Try fewer photos, or smaller ones.";
const OFFLINE_MESSAGE = "Alchemia can't be reached right now. Check your internet and try again.";
const TIMEOUT_MESSAGE = "That took too long. Please try again.";
const GENERIC_MESSAGE = "Something went wrong. Please try again.";

// An error whose message is safe and friendly to show to the user.
export class FriendlyError extends Error {}

// Read our route's JSON answer; throw a FriendlyError if it failed or isn't JSON.
export async function readResponse<T>(res: Response): Promise<T> {
  if (res.status === 413) throw new FriendlyError(TOO_LARGE_MESSAGE);
  if (res.status === 504) throw new FriendlyError(TIMEOUT_MESSAGE);

  let data: { error?: unknown } | null = null;
  try {
    data = await res.json();
  } catch {
    throw new FriendlyError(GENERIC_MESSAGE); // not JSON (e.g. a platform error page)
  }

  if (!res.ok) {
    throw new FriendlyError(typeof data?.error === "string" ? data.error : GENERIC_MESSAGE);
  }
  return data as T;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// Send a body (JSON or FormData) to one of our routes and read the answer.
export async function sendToApi<T>(url: string, body: BodyInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body, headers: typeof body === "string" ? JSON_HEADERS : undefined });
  } catch {
    throw new FriendlyError(OFFLINE_MESSAGE);
  }
  return readResponse<T>(res);
}

// POST JSON to one of our routes. Refuses (with a friendly message) if the body is too big.
export async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const body = JSON.stringify(payload);
  if (body.length > MAX_BODY_CHARS) throw new FriendlyError(TOO_LARGE_MESSAGE);
  return sendToApi<T>(url, body);
}
