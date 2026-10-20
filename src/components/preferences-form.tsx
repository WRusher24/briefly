"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import type { Preferences } from "@/lib/preferences";
import { Banner, Switch, TagInput } from "./ui";

export function PreferencesForm({ initial, name, email }: { initial: Preferences; name: string; email: string }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [light, setLight] = useState(false);

  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwMsg, setPwMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  useEffect(() => setLight(document.documentElement.classList.contains("light")), []);

  function setTheme(isLight: boolean) {
    setLight(isLight);
    document.documentElement.classList.toggle("light", isLight);
    try {
      localStorage.setItem("briefly-theme", isLight ? "light" : "dark");
    } catch {
      /* storage unavailable */
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      setPrefs(await api<Preferences>("/api/settings/preferences", { method: "PUT", body: prefs }));
      setMsg({ kind: "ok", text: "Preferences saved. They apply from the next update." });
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    try {
      await api("/api/account/password", { method: "PUT", body: { current: pw.current, next: pw.next } });
      setPw({ current: "", next: "" });
      setPwMsg({ kind: "ok", text: "Password changed. Other devices have been signed out." });
    } catch (err) {
      setPwMsg({ kind: "error", text: err instanceof Error ? err.message : "Could not change password" });
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: {} });
    router.replace("/login");
    router.refresh();
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteMsg(null);
    try {
      await api("/api/account", { method: "DELETE", body: { password: deletePw } });
      router.replace("/register");
      router.refresh();
    } catch (err) {
      setDeleteMsg(err instanceof Error ? err.message : "Could not delete the account");
    }
  }

  return (
    <div className="space-y-10">
      <form onSubmit={save} className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Preferences</h1>
          <p className="mt-1 text-[13px] text-muted">Tune the filter that runs before anything reaches your AI.</p>
        </div>

        <section className="space-y-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">⚽ Sports</h2>
          <div>
            <label htmlFor="teams" className="label">
              Priority teams
            </label>
            <TagInput id="teams" value={prefs.favoriteTeams} onChange={(favoriteTeams) => setPrefs({ ...prefs, favoriteTeams })} placeholder="Add a team and press Enter" max={12} />
            <p className="mt-1.5 text-xs text-faint">News about these clubs always gets priority (default: Real Madrid, Newcastle).</p>
          </div>
          <div className="card divide-y divide-line">
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-medium">Massive boxing events</p>
                <p className="text-xs text-faint">Unification and superstar fights only.</p>
              </div>
              <Switch checked={prefs.includeBoxing} onChange={(includeBoxing) => setPrefs({ ...prefs, includeBoxing })} label="Include massive boxing events" />
            </div>
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-medium">Massive NBA events</p>
                <p className="text-xs text-faint">Finals, playoffs turning points, blockbuster trades.</p>
              </div>
              <Switch checked={prefs.includeNba} onChange={(includeNba) => setPrefs({ ...prefs, includeNba })} label="Include massive NBA events" />
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">All domains</h2>
          <div>
            <label htmlFor="boost" className="label">
              Boost keywords
            </label>
            <TagInput id="boost" value={prefs.boostKeywords} onChange={(boostKeywords) => setPrefs({ ...prefs, boostKeywords })} placeholder="e.g. semiconductors, Taiwan, Mbappé" max={30} />
          </div>
          <div>
            <label htmlFor="mute" className="label">
              Mute keywords
            </label>
            <TagInput id="mute" value={prefs.muteKeywords} onChange={(muteKeywords) => setPrefs({ ...prefs, muteKeywords })} placeholder="Stories mentioning these are dropped" max={30} />
          </div>
          <div>
            <label htmlFor="max" className="label">
              New stories per domain, per update: {prefs.maxStoriesPerDomain}
            </label>
            <input id="max" type="range" min={3} max={15} step={1} value={prefs.maxStoriesPerDomain} onChange={(e) => setPrefs({ ...prefs, maxStoriesPerDomain: Number(e.target.value) })} className="h-11 w-full accent-[rgb(var(--accent))]" />
            <p className="text-xs text-faint">Lower = fewer AI calls and a tighter briefing. Great for free-tier limits.</p>
          </div>
        </section>

        {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
        <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
          {saving ? "Saving…" : "Save preferences"}
        </button>
      </form>

      <section className="space-y-3 border-t border-line pt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">Appearance</h2>
        <div className="card flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm font-medium">Light theme</p>
            <p className="text-xs text-faint">Briefly is dark by default.</p>
          </div>
          <Switch checked={light} onChange={setTheme} label="Use light theme" />
        </div>
      </section>

      <section className="space-y-4 border-t border-line pt-8">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">Account</h2>
          <p className="mt-2 text-sm">
            {name} <span className="text-muted">· {email}</span>
          </p>
        </div>

        <form onSubmit={changePassword} className="card space-y-3 p-4">
          <p className="text-sm font-medium">Change password</p>
          <input aria-label="Current password" type="password" autoComplete="current-password" className="input" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          <input aria-label="New password" type="password" autoComplete="new-password" className="input" placeholder="New password (10+ characters)" minLength={10} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
          {pwMsg && <Banner kind={pwMsg.kind}>{pwMsg.text}</Banner>}
          <button type="submit" className="btn-ghost">
            Update password
          </button>
        </form>

        <button onClick={logout} className="btn-ghost w-full sm:w-auto">
          Sign out
        </button>

        <div className="card space-y-3 border-danger/30 p-4">
          <p className="text-sm font-medium text-danger">Delete account</p>
          <p className="text-xs text-muted">Permanently removes your account, feeds, stories, settings, API key and saved library. This cannot be undone.</p>
          {deleting ? (
            <form onSubmit={deleteAccount} className="space-y-3">
              <input aria-label="Confirm password" type="password" autoComplete="current-password" className="input" placeholder="Enter your password to confirm" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} required />
              {deleteMsg && <Banner kind="error">{deleteMsg}</Banner>}
              <div className="flex gap-2">
                <button type="submit" className="btn-danger">
                  Delete everything
                </button>
                <button type="button" onClick={() => setDeleting(false)} className="btn-ghost">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setDeleting(true)} className="btn-danger">
              Delete my account…
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
