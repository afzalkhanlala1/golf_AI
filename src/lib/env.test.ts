import { afterEach, describe, expect, it, vi } from "vitest";

const REQUIRED = {
  DATABASE_URL: "postgresql://user:pass@host/db?sslmode=require",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_placeholder",
  CLERK_SECRET_KEY: "sk_test_placeholder",
  OPENROUTER_API_KEY: "sk-or-v1-placeholder",
  INFERENCE_MODE: "mock",
  INFERENCE_SHARED_SECRET: "test-shared-secret",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("getEnv", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("parses a valid environment", async () => {
    for (const [key, value] of Object.entries(REQUIRED)) {
      vi.stubEnv(key, value);
    }

    const { getEnv } = await import("./env");
    const env = getEnv();
    expect(env.INFERENCE_MODE).toBe("mock");
    expect(env.OPENROUTER_API_KEY).toContain("sk-or");
    expect(env.ADMIN_EMAILS).toBe("");
  });

  it("accepts an optional ADMIN_EMAILS allowlist", async () => {
    for (const [key, value] of Object.entries(REQUIRED)) {
      vi.stubEnv(key, value);
    }
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com, ops@example.com");

    const { getEnv } = await import("./env");
    expect(getEnv().ADMIN_EMAILS).toBe("owner@example.com, ops@example.com");
  });

  it("fails fast when required vars are missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("INFERENCE_MODE", "mock");

    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow(/Invalid environment variables/);
  });

  it("requires INFERENCE_URL when mode is modal", async () => {
    for (const [key, value] of Object.entries(REQUIRED)) {
      vi.stubEnv(key, value);
    }
    vi.stubEnv("INFERENCE_MODE", "modal");
    vi.stubEnv("INFERENCE_URL", "");

    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow(/INFERENCE_URL/);
  });
});
