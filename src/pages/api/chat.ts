/**
 * Server-side proxy to OpenRouter.
 *
 * The app's own OpenRouter key lives here and is never sent to the browser.
 * Never expose it via a NEXT_PUBLIC_ variable: those are inlined into the
 * client bundle and can be read by anyone who opens devtools.
 *
 * Runs on the edge runtime so the SSE response can be streamed straight
 * through to the client.
 */
export const config = {
  runtime: "edge",
};

/** Model used for the shared key. Must be a `:free` slug unless explicitly overridden. */
const DEFAULT_MODEL = "nvidia/nemotron-3-nano-30b-a3b:free";

/** Hard caps so a shared key can't be drained by an oversized request. */
const MAX_TOKENS = 512;
const MAX_MESSAGES = 60;
const MAX_TOTAL_CHARS = 24000;

/** Best-effort per-IP throttle. See the note on rateLimit() below. */
const RATE_LIMIT_PER_MINUTE = 12;
const RATE_LIMIT_PER_DAY = 200;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

type Bucket = { minuteStart: number; minuteCount: number; dayStart: number; dayCount: number };

/**
 * In-memory only, so it resets on cold start and isn't shared across edge
 * regions. It stops casual scripted abuse; the real spend ceiling is the free
 * model plus the credit limit set on the OpenRouter key itself.
 */
const buckets = new Map<string, Bucket>();

function rateLimit(ip: string, now: number): string | null {
  const bucket = buckets.get(ip) ?? {
    minuteStart: now,
    minuteCount: 0,
    dayStart: now,
    dayCount: 0,
  };

  if (now - bucket.minuteStart >= MINUTE) {
    bucket.minuteStart = now;
    bucket.minuteCount = 0;
  }
  if (now - bucket.dayStart >= DAY) {
    bucket.dayStart = now;
    bucket.dayCount = 0;
  }

  bucket.minuteCount += 1;
  bucket.dayCount += 1;
  buckets.set(ip, bucket);

  // Keep the map from growing without bound on a long-lived isolate.
  if (buckets.size > 5000) {
    for (const [key, value] of buckets) {
      if (now - value.dayStart >= DAY) buckets.delete(key);
    }
  }

  if (bucket.minuteCount > RATE_LIMIT_PER_MINUTE) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (bucket.dayCount > RATE_LIMIT_PER_DAY) {
    return "Daily limit for the shared key reached. Add your own OpenRouter API key in Settings to keep chatting.";
  }
  return null;
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isAllowedOrigin(req: Request): boolean {
  // Opt-in: unset means "allow anything", which is what local dev and preview
  // deployments need.
  const allowed = process.env.ALLOWED_ORIGINS;
  if (!allowed) return true;

  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser callers, e.g. curl during debugging

  return allowed
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(origin);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return errorResponse(
      500,
      "This deployment has no shared OpenRouter key configured. Add your own API key in Settings."
    );
  }

  if (!isAllowedOrigin(req)) {
    return errorResponse(403, "Origin not allowed");
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  // Guard against a typo in the env var quietly switching the shared key onto
  // a paid model. Opting into paid usage has to be deliberate.
  if (!model.endsWith(":free") && process.env.ALLOW_PAID_MODEL !== "true") {
    return errorResponse(
      500,
      `Refusing to use non-free model "${model}". Set ALLOW_PAID_MODEL=true to allow paid models.`
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse(400, "`messages` must be a non-empty array");
  }
  if (messages.length > MAX_MESSAGES) {
    return errorResponse(400, `Too many messages (max ${MAX_MESSAGES})`);
  }

  let totalChars = 0;
  for (const message of messages) {
    if (
      typeof message?.role !== "string" ||
      typeof message?.content !== "string" ||
      !["system", "user", "assistant"].includes(message.role)
    ) {
      return errorResponse(400, "Each message needs a valid `role` and a string `content`");
    }
    totalChars += message.content.length;
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return errorResponse(400, `Conversation too long (max ${MAX_TOTAL_CHARS} characters)`);
  }

  const ip =
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";
  const limited = rateLimit(ip, Date.now());
  if (limited) {
    return errorResponse(429, limited);
  }

  // The client is not allowed to pick the model, temperature or token budget:
  // those decide what the shared key costs.
  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.SITE_URL || "https://chat-vrm-window.vercel.app/",
      "X-Title": "ChatVRM",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      // gpt-oss style reasoning models count reasoning tokens against
      // max_tokens, so keep the effort low and leave room for the reply.
      reasoning: { effort: "low" },
      messages,
      temperature: 0.7,
      max_tokens: MAX_TOKENS,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("OpenRouter error", upstream.status, detail);
    // Don't forward the upstream body: it can echo key or account details.
    return errorResponse(
      502,
      upstream.status === 429
        ? "The shared key hit OpenRouter's rate limit. Try again shortly, or add your own API key in Settings."
        : "Upstream model request failed."
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
