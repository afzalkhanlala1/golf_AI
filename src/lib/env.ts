import { z } from "zod";

/**
 * Fail-fast environment validation.
 * OPENROUTER_API_KEY is used for coaching feedback.
 */

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BLOB_READ_WRITE_TOKEN: z.string().min(1, "BLOB_READ_WRITE_TOKEN is required"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  ANTHROPIC_API_KEY: z.string().optional().or(z.literal("")),
  INFERENCE_MODE: z.enum(["mock", "modal"]),
  INFERENCE_URL: z.string().url().optional().or(z.literal("")),
  INFERENCE_SHARED_SECRET: z
    .string()
    .min(1, "INFERENCE_SHARED_SECRET is required"),
  SWINGNET_CHECKPOINT_URL: z.string().url().optional().or(z.literal("")),
  STRIPE_SECRET_KEY: z.string().optional().or(z.literal("")),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),
  /**
   * Comma-separated Clerk emails that may open `/admin`. Empty means nobody
   * is an admin (fail closed), except the local AUTH_DISABLED bypass.
   */
  ADMIN_EMAILS: z.string().optional().or(z.literal("")),
});

export type Env = z.infer<typeof envSchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
    INFERENCE_MODE: process.env.INFERENCE_MODE ?? "mock",
    INFERENCE_URL: process.env.INFERENCE_URL ?? "",
    INFERENCE_SHARED_SECRET: process.env.INFERENCE_SHARED_SECRET,
    SWINGNET_CHECKPOINT_URL: process.env.SWINGNET_CHECKPOINT_URL ?? "",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? "",
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${formatZodError(parsed.error)}`,
    );
  }

  if (parsed.data.INFERENCE_MODE === "modal" && !parsed.data.INFERENCE_URL) {
    throw new Error(
      "Invalid environment variables:\n  - INFERENCE_URL: required when INFERENCE_MODE=modal",
    );
  }

  cached = parsed.data;
  return cached;
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  return url;
}
