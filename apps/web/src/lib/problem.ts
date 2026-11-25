export type ProblemCode = string;

export function problemCode(error: unknown): ProblemCode {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(error.code);
  }
  return "UNAVAILABLE";
}

export const NETWORK = "NETWORK";
