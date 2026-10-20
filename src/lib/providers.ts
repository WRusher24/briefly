export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  keyUrl: string;
  note: string;
}

/** Free-tier friendly, OpenAI-compatible endpoints. "custom" accepts any /chat/completions server. */
export const PROVIDERS: ProviderPreset[] = [
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-20b"],
    keyUrl: "https://console.groq.com/keys",
    note: "Very fast, generous free tier. Recommended.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.0-flash-lite"],
    keyUrl: "https://aistudio.google.com/apikey",
    note: "Free tier via Google AI Studio (OpenAI-compatible endpoint).",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    models: ["meta-llama/llama-3.3-70b-instruct:free", "deepseek/deepseek-chat-v3-0324:free", "google/gemini-2.0-flash-exp:free"],
    keyUrl: "https://openrouter.ai/keys",
    note: "Many models marked “:free”. Free models have tight rate limits.",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"],
    keyUrl: "https://platform.openai.com/api-keys",
    note: "Paid, but gpt-4o-mini is inexpensive.",
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    baseUrl: "",
    defaultModel: "",
    models: [],
    keyUrl: "",
    note: "Any server exposing POST {base URL}/chat/completions.",
  },
];

export function getProvider(id: string): ProviderPreset {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[PROVIDERS.length - 1];
}
