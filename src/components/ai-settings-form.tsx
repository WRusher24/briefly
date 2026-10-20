"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { PROVIDERS, getProvider } from "@/lib/providers";
import { Banner } from "./ui";

interface Props {
  initial: { provider: string; baseUrl: string; model: string; hasKey: boolean; keyLast4: string | null };
  welcome: boolean;
}

export function AiSettingsForm({ initial, welcome }: Props) {
  const router = useRouter();
  const [provider, setProvider] = useState(initial.provider);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(initial.hasKey);
  const [last4, setLast4] = useState(initial.keyLast4);
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const preset = getProvider(provider);

  function selectProvider(id: string) {
    const p = getProvider(id);
    setProvider(id);
    if (id !== "custom") {
      setBaseUrl(p.baseUrl);
      setModel(p.defaultModel);
    }
    setResult(null);
  }

  async function test() {
    setBusy("test");
    setResult(null);
    try {
      const res = await api<{ ok: boolean; message: string }>("/api/settings/ai/test", { body: { baseUrl, model, apiKey: apiKey || undefined } });
      setResult({ kind: res.ok ? "ok" : "error", text: res.message });
    } catch (err) {
      setResult({ kind: "error", text: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setResult(null);
    try {
      await api("/api/settings/ai", { method: "PUT", body: { provider, baseUrl, model, apiKey: apiKey || undefined } });
      if (apiKey) {
        setHasKey(true);
        setLast4(apiKey.slice(-4));
        setApiKey("");
      }
      setResult({ kind: "ok", text: apiKey ? "Saved. Your first briefing will be generated shortly — open the Briefing tab and tap Refresh." : "Settings saved." });
      router.refresh();
    } catch (err) {
      setResult({ kind: "error", text: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setBusy(null);
    }
  }

  async function removeKey() {
    setBusy("remove");
    try {
      await api("/api/settings/ai", { method: "DELETE" });
      setHasKey(false);
      setLast4(null);
      setResult({ kind: "ok", text: "API key removed. Automatic updates are paused until you add a new one." });
      router.refresh();
    } catch (err) {
      setResult({ kind: "error", text: err instanceof Error ? err.message : "Could not remove the key" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">AI provider</h1>
        <p className="mt-1 text-[13px] text-muted">
          Briefly summarises and analyses stories with your own API key. It’s encrypted at rest and only ever used from the server.
        </p>
      </div>

      {welcome && !hasKey && <Banner kind="info">Welcome to Briefly! Add a free API key below to generate your first briefing.</Banner>}

      <div>
        <p className="label">Provider</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Provider">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={provider === p.id}
              onClick={() => selectProvider(p.id)}
              className={`min-h-[48px] rounded-xl border px-3 text-sm transition ${provider === p.id ? "border-accent bg-accent/10 text-fg" : "border-line text-muted hover:text-fg"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">
          {preset.note}{" "}
          {preset.keyUrl && (
            <a href={preset.keyUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4">
              Get a key
            </a>
          )}
        </p>
      </div>

      <div>
        <label htmlFor="apiKey" className="label">
          API key
        </label>
        <input
          id="apiKey"
          type="password"
          className="input font-mono"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={hasKey ? `Saved (…${last4 ?? "????"}) · paste to replace` : "Paste your API key"}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div>
        <label htmlFor="baseUrl" className="label">
          Base URL
        </label>
        <input id="baseUrl" type="url" className="input font-mono text-sm" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required placeholder="https://api.example.com/v1" />
        <p className="mt-1.5 text-xs text-faint">Requests go to {"{base URL}"}/chat/completions.</p>
      </div>

      <div>
        <label htmlFor="model" className="label">
          Model
        </label>
        <input id="model" className="input font-mono text-sm" value={model} onChange={(e) => setModel(e.target.value)} required list="model-options" autoComplete="off" spellCheck={false} />
        <datalist id="model-options">
          {preset.models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <p className="mt-1.5 text-xs text-faint">Pick a suggestion or type any model id your provider supports.</p>
      </div>

      {result && <Banner kind={result.kind}>{result.text}</Banner>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={busy !== null} className="btn-primary flex-1">
          {busy === "save" ? "Saving…" : "Save settings"}
        </button>
        <button type="button" onClick={test} disabled={busy !== null || (!apiKey && !hasKey)} className="btn-ghost flex-1">
          {busy === "test" ? "Testing…" : "Test connection"}
        </button>
      </div>

      {hasKey && (
        <div className="border-t border-line pt-5">
          <button type="button" onClick={removeKey} disabled={busy !== null} className="btn-danger">
            Remove stored API key
          </button>
        </div>
      )}
    </form>
  );
}
