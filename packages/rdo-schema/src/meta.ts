import type { z } from "zod";

export type FieldLevel = "universal" | "public_financed" | "recommended";
export type FieldOrigin = "site" | "report";

export interface FieldMeta {
  level: FieldLevel;
  origin: FieldOrigin;
  guideName: string;
  conditional?: true;
  nonEmpty?: true;
}

type MetaOptions = Pick<FieldMeta, "conditional" | "nonEmpty">;

export function field<T extends z.ZodType>(
  schema: T,
  level: FieldLevel,
  origin: FieldOrigin,
  guideName: string,
  options: MetaOptions = {},
) {
  return schema.nullable().meta({ level, origin, guideName, ...options });
}

export function list<T extends z.ZodType>(
  schema: T,
  level: FieldLevel,
  origin: FieldOrigin,
  guideName: string,
  options: MetaOptions = {},
) {
  return schema.meta({ level, origin, guideName, ...options });
}
