/**
 * Turns an OpenAI/OpenRouter-style SSE response body into a stream of the
 * assistant's text deltas.
 *
 * Kept dependency-free so it can be unit tested on its own.
 */
export function sseStreamToTextStream(
  body: ReadableStream<Uint8Array>
): ReadableStream<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<string>({
    async start(controller: ReadableStreamDefaultController<string>) {
      // SSE lines can be split across chunk boundaries, so hold the trailing
      // partial line until the rest of it arrives.
      let buffer = "";

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return;

        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") return;

        let parsed: any;
        try {
          parsed = JSON.parse(payload);
        } catch {
          // OpenRouter interleaves ": OPENROUTER PROCESSING" keep-alive
          // comments and occasional non-JSON noise; skipping them is safe.
          return;
        }

        const content = parsed?.choices?.[0]?.delta?.content;
        // Role-only and reasoning deltas carry no content.
        if (content) {
          controller.enqueue(content);
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.forEach(handleLine);
        }

        buffer += decoder.decode();
        if (buffer) handleLine(buffer);
      } catch (error) {
        controller.error(error);
        return;
      } finally {
        reader.releaseLock();
      }

      controller.close();
    },
  });
}
