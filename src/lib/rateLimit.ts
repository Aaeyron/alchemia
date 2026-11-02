// A simple per-IP rate limit for the API routes, to protect the API credits.
//
// IMPORTANT: the counts live in this server instance's memory. On Vercel each serverless
// instance has its own memory, and it is wiped whenever the instance restarts or scales.
// So these limits are per instance and reset often: a basic safeguard, not a guarantee.
// (A shared store such as a database or Redis would be needed for exact limits.)

const WINDOW_MS = 60 * 60 * 1000; // one hour

// Requests allowed per IP per hour, for each route.
export const LIMITS = {
  visualize: 20,
  ideas: 30,
  tweak: 40,
  segment: 40,
  detect: 30,
  transcribe: 40,
  "voice-intent": 40,
  "check-picture": 20,
  guide: 30,
  "step-image": 40,
} as const;

export type LimitedRoute = keyof typeof LIMITS;

export const RATE_LIMIT_MESSAGE = "You've used Alchemia a lot today! Please try again in a little while.";

// "route:ip" -> how many requests in the current window, and when that window ends.
const counters = new Map<string, { count: number; resetAt: number }>();

// The visitor's IP: the first value of x-forwarded-for (Vercel sets this header).
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

// Forget finished windows now and then, so the map doesn't grow forever.
function cleanUp(now: number) {
  if (counters.size < 5000) return;
  for (const [key, counter] of counters) {
    if (counter.resetAt <= now) counters.delete(key);
  }
}

/**
 * Count this request. Returns a ready-made 429 response if the visitor is over the
 * limit for this route, or null if the request may go ahead.
 */
export function checkRateLimit(request: Request, route: LimitedRoute): Response | null {
  const now = Date.now();
  cleanUp(now);

  const key = `${route}:${clientIp(request)}`;
  const counter = counters.get(key);
  if (!counter || counter.resetAt <= now) {
    counters.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  counter.count += 1;
  if (counter.count <= LIMITS[route]) return null;

  const retryAfterSeconds = Math.ceil((counter.resetAt - now) / 1000);
  return Response.json(
    { error: RATE_LIMIT_MESSAGE },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
