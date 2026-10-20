import { readText, safeFetch } from "@/lib/net";
import { extractJson } from "./json";

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class AiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryable = false,
  ) {
    super(message);
  }
}

interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  /** Ask the server for a JSON object (silently dropped for servers that reject it). */
  json?: boolean;
  timeoutMs?: number;
  /** Total attempts for retryable failures (429 / 5xx / network). */
  attempts?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function friendlyError(status: number, body: string): string {
  let detail = body.slice(0, 300);
  try {
    const parsed = JSON.parse(body);
    detail = parsed?.error?.message ?? parsed?.message ?? parsed?.[0]?.error?.message ?? detail;
  } catch {
    // keep raw body
  }
  if (status === 401 || status === 403) return `The AI provider rejected the API key (${status}). ${detail}`;
  if (status === 404) return `Model or endpoint not found (404). Check the base URL and model name. ${detail}`;
  if (status === 429) return `The AI provider rate-limited the request (429). ${detail}`;
  return `AI provider error ${status}: ${detail}`;
}

/** Minimal OpenAI-compatible chat-completions client (Groq, OpenRouter, Gemini, OpenAI, Ollama, …). */
export class AiClient {
  constructor(private config: AiConfig) {}

  /** Number of HTTP requests issued (for run statistics). */
  calls = 0;

  async complete(messages: ChatMessage[], options: CompletionOptions = {}): Promise<string> {
    const { temperature = 0.2, maxTokens = 2500, json = false, timeoutMs = 45_000, attempts = 3 } = options;
    let useJsonMode = json;
    let lastError: AiError | null = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      this.calls++;
      try {
        const res = await safeFetch(endpoint(this.config.baseUrl), {
          method: "POST",
          timeoutMs,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
            "HTTP-Referer": "https://briefly.app",
            "X-Title": "Briefly",
          },
          body: JSON.stringify({
            model: this.config.model,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
          }),
        });

        if (res.ok) {
          const data = JSON.parse(await readText(res, 2_000_000));
          const content: unknown = data?.choices?.[0]?.message?.content;
          if (typeof content !== "string" || !content.trim()) throw new AiError("The model returned an empty reply", 200, true);
          return content;
        }

        const body = await readText(res, 20_000);
        // Some servers reject response_format — retry once without it.
        if (res.status === 400 && useJsonMode && /response_format|json_object|json mode/i.test(body)) {
          useJsonMode = false;
          attempt--;
          continue;
        }

        const retryable = res.status === 429 || res.status >= 500 || res.status === 408;
        lastError = new AiError(friendlyError(res.status, body), res.status, retryable);
        if (!retryable) throw lastError;

        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 20) * 1000 : 1500 * 2 ** (attempt - 1);
        if (attempt < attempts) await sleep(wait);
      } catch (err) {
        if (err instanceof AiError) {
          lastError = err;
          if (!err.retryable) throw err;
          if (attempt < attempts) await sleep(1200 * attempt);
          continue;
        }
        const message = err instanceof Error ? err.message : String(err);
        lastError = new AiError(`Could not reach the AI provider: ${message}`, undefined, true);
        if (attempt < attempts) await sleep(1200 * attempt);
      }
    }
    throw lastError ?? new AiError("AI request failed");
  }

  /** Completion that must return JSON; retries once on malformed output. */
  async completeJson(messages: ChatMessage[], options: CompletionOptions = {}): Promise<unknown> {
    let lastErr: unknown;
    for (let i = 0; i < 2; i++) {
      const text = await this.complete(messages, { ...options, json: true });
      try {
        return extractJson(text);
      } catch (err) {
        lastErr = err;
      }
    }
    throw new AiError(`The model did not return valid JSON (${lastErr instanceof Error ? lastErr.message : "unknown"})`, 200, false);
  }

  /** Cheap connectivity check used by the Settings page. */
  async ping(): Promise<{ ok: true; sample: string }> {
    const text = await this.complete([{ role: "user", content: "Reply with the single word: ready" }], {
      maxTokens: 16,
      temperature: 0,
      attempts: 1,
      timeoutMs: 20_000,
    });
    return { ok: true, sample: text.trim().slice(0, 40) };
  }
}
