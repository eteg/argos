import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().default(3001),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  GIT_COMMIT: z.string().min(1).default("dev"),
  DATABASE_URL: z.string().min(1),
  API_KEY: z.string().min(1),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  API_PUBLIC_URL: z.string().min(1).default("http://localhost:3001"),
  ENGINEER_ID: z.string().min(1).default("3f0c1b2a-8d4e-4f60-9a71-2b3c4d5e6f70"),
  ENGINEER_NAME: z.string().min(1).default("Rafael Lima"),
  ENGINEER_TITLE: z.string().min(1).default("Eng. Rafael Lima"),
  ENGINEER_COMPANY: z.string().min(1).default("Construtora Horizonte"),
  ANTHROPIC_API_KEY: z.string().min(1),
  AI_ENABLED: z.enum(["true", "false"]).default("true"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.1-flash-lite"),
  GEMINI_FALLBACK_MODELS: z.string().default("gemini-flash-lite-latest,gemini-3.5-flash-lite,gemini-3.6-flash"),
  ANTHROPIC_MODEL: z.string().min(1),
  LANGFUSE_PUBLIC_KEY: z.string().min(1),
  LANGFUSE_SECRET_KEY: z.string().min(1),
  LANGFUSE_BASE_URL: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid environment, check: ${missing}`);
}

export const env = loadEnv();

export const aiEnabled = () => env.AI_ENABLED === "true" && env.GEMINI_API_KEY !== undefined && env.ANTHROPIC_API_KEY !== "dummy";
