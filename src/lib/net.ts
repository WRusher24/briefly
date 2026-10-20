import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { env } from "./env";

export class UnsafeUrlError extends Error {}

export function isPrivateAddress(ip: string): boolean {
  if (ip.startsWith("::ffff:")) return isPrivateAddress(ip.slice(7));
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || /^fe[89ab]/.test(v6);
}

/** Throws UnsafeUrlError unless the URL is http(s) and resolves only to public addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("Only http(s) URLs are allowed");
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials are not allowed");
  if (env().ALLOW_PRIVATE_HOSTS) return url;

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new UnsafeUrlError("Private hosts are not allowed");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new UnsafeUrlError("Host could not be resolved");
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new UnsafeUrlError("Private hosts are not allowed");
  return url;
}

export interface SafeFetchOptions extends Omit<RequestInit, "redirect" | "signal"> {
  timeoutMs?: number;
  maxRedirects?: number;
}

/** fetch() with SSRF protection on every hop, a hard timeout and manual redirect handling. */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 10_000, maxRedirects = 4, ...init } = opts;
  let target = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicUrl(target);
    const res = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    if (res.status >= 300 && res.status < 400 && res.status !== 304) {
      const location = res.headers.get("location");
      if (!location) return res;
      await res.body?.cancel();
      target = new URL(location, url).toString();
      continue;
    }
    return res;
  }
  throw new UnsafeUrlError("Too many redirects");
}

/** Reads a response body as text, aborting once `maxBytes` has been exceeded. */
export async function readText(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}
