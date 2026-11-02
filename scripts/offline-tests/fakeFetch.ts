// A fake fetch for the offline tests: no network, no API key, no credits.
// Each test says how the fake Meta API answers; the calls are recorded so the test can check them.

export type FakeCall = { url: string; body: Record<string, unknown> };
type Answer = (call: FakeCall, callNumber: number) => Response | Promise<Response>;

// Set before the routes are imported (meta.ts reads it once). Not a real key.
process.env.MODEL_API_KEY = "offline-test-key";

export function fakeFetch(answer: Answer): FakeCall[] {
  const calls: FakeCall[] = [];
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), body: init?.body ? JSON.parse(String(init.body)) : {} };
    calls.push(call);
    return answer(call, calls.length);
  };
  return calls;
}

// What Muse Spark's /chat/completions answers.
export const sparkReply = (content: unknown) =>
  Response.json({ choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }] });

// What Muse Image's /images/edits answers.
export const imageReply = (b64: string) => Response.json({ data: [{ b64_json: b64 }], output_format: "webp" });

// An error from the API, like meta.ts sees it (status + body text).
export const errorReply = (status: number, body = "server error") => new Response(body, { status });

// A request to one of our routes. Each test uses its own IP, so the rate limits don't mix.
let nextIp = 1;
export function post(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${nextIp++}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// The text prompt that was sent to Muse Spark or Muse Image in a recorded call.
export function promptOf(call: FakeCall): string {
  const messages = call.body.messages as { content: { type: string; text?: string }[] }[] | undefined;
  if (messages) return messages[0].content.find((part) => part.type === "text")?.text ?? "";
  return String(call.body.prompt ?? "");
}
