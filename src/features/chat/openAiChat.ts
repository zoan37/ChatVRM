import { Message } from "../messages/messages";
import { buildUrl } from "@/utils/buildUrl";
import { sseStreamToTextStream } from "./sseStream";

/**
 * Models used when the user brings their own OpenRouter key, tried in order.
 * Free so nobody gets a surprise bill. Kept in step with `MODELS` in
 * `pages/api/chat.ts`, which the browser can't override for the shared key.
 */
const BYOK_MODELS = ["nvidia/nemotron-3-ultra-550b-a55b:free", "openrouter/free"];

const SITE_URL = "https://chat-vrm-window.vercel.app/";
const SITE_NAME = "ChatVRM";

/**
 * Calls the user's own OpenRouter key directly from the browser. Only used for
 * a key the user typed in themselves — it stays in their browser, and this path
 * keeps the app working on static builds (GitHub Pages) that have no server.
 */
async function fetchWithUserKey(messages: Message[], openRouterKey: string) {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "HTTP-Referer": SITE_URL,
      "X-Title": SITE_NAME,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      models: BYOK_MODELS,
      reasoning: { effort: "low" },
      messages,
      temperature: 0.7,
      max_tokens: 512,
      stream: true,
    }),
  });
}

/**
 * Calls our own serverless function, which holds the shared OpenRouter key.
 * The key never reaches the browser.
 */
async function fetchViaServer(messages: Message[]) {
  // Trailing slash matches `trailingSlash: true` in next.config.js, avoiding a
  // 308 redirect on every request.
  return fetch(buildUrl("/api/chat/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Chat request failed (${response.status})`;
  try {
    const text = await response.text();
    if (!text) return fallback;
    try {
      return JSON.parse(text).error || fallback;
    } catch {
      // A static export (e.g. GitHub Pages) has no API routes, so /api/chat
      // returns an HTML 404 rather than JSON.
      return response.status === 404
        ? "No server-side API key is available on this deployment. Enter your own OpenRouter API key in Settings."
        : fallback;
    }
  } catch {
    return fallback;
  }
}

export async function getChatResponseStream(
  messages: Message[],
  apiKey: string,
  openRouterKey: string
) {
  const response = openRouterKey
    ? await fetchWithUserKey(messages, openRouterKey)
    : await fetchViaServer(messages);

  if (!response.ok || !response.body) {
    throw new Error(await readErrorMessage(response));
  }

  return sseStreamToTextStream(response.body);
}
