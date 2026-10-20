"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { TrashIcon } from "./icons";

export function SavedActions({ id, initialNote }: { id: string; initialNote: string }) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [savedNote, setSavedNote] = useState(initialNote);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [confirming, setConfirming] = useState(false);

  async function saveNote() {
    setStatus("saving");
    try {
      await api(`/api/saved/${id}`, { method: "PATCH", body: { note } });
      setSavedNote(note);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function remove() {
    await api(`/api/saved/${id}`, { method: "DELETE" });
    router.replace("/library");
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-6 border-t border-line pt-6">
      <div>
        <label htmlFor="note" className="label">
          Your note
        </label>
        <textarea id="note" className="input min-h-[96px] resize-y" maxLength={2000} placeholder="Why did you keep this? What should you remember when you look back?" value={note} onChange={(e) => { setNote(e.target.value); setStatus("idle"); }} />
        <div className="mt-2 flex items-center gap-3">
          <button onClick={saveNote} disabled={note === savedNote || status === "saving"} className="btn-ghost">
            {status === "saving" ? "Saving…" : "Save note"}
          </button>
          {status === "saved" && <span className="text-sm text-ok">Saved</span>}
          {status === "error" && <span className="text-sm text-danger">Could not save</span>}
        </div>
      </div>

      {confirming ? (
        <div className="flex items-center gap-2">
          <button onClick={remove} className="btn-danger">
            Yes, remove from library
          </button>
          <button onClick={() => setConfirming(false)} className="btn-ghost">
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="btn-ghost text-muted">
          <TrashIcon className="h-[18px] w-[18px]" />
          Remove from library
        </button>
      )}
    </div>
  );
}
