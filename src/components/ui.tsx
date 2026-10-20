"use client";

import { useState } from "react";
import { CloseIcon } from "./icons";

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition disabled:opacity-50 ${checked ? "border-accent bg-accent" : "border-line bg-raised"}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

export function TagInput({ id, value, onChange, placeholder, max = 20 }: { id: string; value: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number }) {
  const [draft, setDraft] = useState("");

  function commit() {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    if (parts.length === 0) return setDraft("");
    const merged = [...value];
    for (const p of parts) if (!merged.some((m) => m.toLowerCase() === p.toLowerCase()) && merged.length < max) merged.push(p);
    onChange(merged);
    setDraft("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span key={tag} className="chip gap-1.5 bg-raised py-1.5 pl-3 pr-1.5 text-[13px] text-fg">
            {tag}
            <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`} className="grid h-5 w-5 place-items-center rounded-full text-faint hover:bg-line hover:text-fg">
              <CloseIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        id={id}
        className="input mt-2"
        value={draft}
        placeholder={placeholder}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={commit}
      />
    </div>
  );
}

export function Banner({ kind, children }: { kind: "ok" | "error" | "info"; children: React.ReactNode }) {
  const styles = {
    ok: "border-ok/30 bg-ok/10 text-ok",
    error: "border-danger/30 bg-danger/10 text-danger",
    info: "border-accent/30 bg-accent/10 text-fg",
  }[kind];
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-2.5 text-sm ${styles}`}>
      {children}
    </p>
  );
}
