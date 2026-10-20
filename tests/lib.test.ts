import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgres://localhost/test";
  process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-123";
});

describe("extractJson", () => {
  it("handles fenced, prefixed and nested JSON", async () => {
    const { extractJson } = await import("@/lib/ai/json");
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here you go: {"items":[{"x":"}"}]} hope that helps')).toEqual({ items: [{ x: "}" }] });
    expect(extractJson("[1,2,3]")).toEqual([1, 2, 3]);
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("crypto", () => {
  it("round-trips secrets and rejects tampering", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const enc = encryptSecret("gsk_abc123");
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("gsk_abc123");
    expect(decryptSecret(enc)).toBe("gsk_abc123");
    expect(encryptSecret("gsk_abc123")).not.toBe(enc); // random IV
    const parts = enc.split(":");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });
});

describe("SSRF guard", () => {
  it("flags private and loopback addresses", async () => {
    const { isPrivateAddress, assertPublicUrl } = await import("@/lib/net");
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
    await expect(assertPublicUrl("http://localhost:3000/x")).rejects.toThrow();
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow();
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicUrl("https://user:pw@example.com/")).rejects.toThrow();
  });
});

describe("read time", () => {
  it("rounds to 5s with a 15s floor and formats minutes past 90s", async () => {
    const { estimateReadSeconds, formatReadTime } = await import("@/lib/readtime");
    expect(estimateReadSeconds("short")).toBe(15);
    expect(estimateReadSeconds(Array(150).fill("word").join(" "))).toBe(40);
    expect(formatReadTime(45)).toBe("⏱️ 45 sec read");
    expect(formatReadTime(120)).toBe("⏱️ 2 min read");
  });
});

describe("preferences", () => {
  it("falls back to defaults for missing or invalid stored data", async () => {
    const { normalizePreferences, DEFAULT_PREFERENCES } = await import("@/lib/preferences");
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences({ includeNba: false }).includeNba).toBe(false);
    expect(normalizePreferences({ maxStoriesPerDomain: 999 })).toEqual(DEFAULT_PREFERENCES);
  });
});
