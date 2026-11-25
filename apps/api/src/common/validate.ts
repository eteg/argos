import type { z } from "zod";
import { ProblemException } from "./problem.js";

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    code: issue.code === "invalid_type" && issue.message.includes("undefined") ? "REQUIRED" : "INVALID",
  }));
  throw new ProblemException(400, "VALIDATION", "Invalid data.", errors);
}
