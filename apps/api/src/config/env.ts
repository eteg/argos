import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().default(3001),
  APP_ENV: z.enum(["development", "staging"]).default("development"),
  GIT_COMMIT: z.string().min(1).default("dev"),
  DATABASE_URL: z.string().min(1),
  API_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid environment, check: ${missing}`);
}

export const env = loadEnv();
