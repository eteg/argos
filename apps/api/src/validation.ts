import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

// Valida a entrada e responde 400 VALIDATION com o campo e o motivo, como pedem as convenções.
export function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  throw new BadRequestException({
    message: "Invalid data",
    errors: result.error.issues.map((i) => ({ field: i.path.join("."), code: i.code.toUpperCase(), message: i.message })),
  });
}

export const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracyMeters: z.number().nullable().optional().transform((v) => v ?? null),
});

export function todayIn(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}
