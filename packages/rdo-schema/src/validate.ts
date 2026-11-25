import type { z } from "zod";
import type { SiteType } from "./enums.js";
import { reportContentJsonSchema, reportJsonSchema } from "./json-schema.js";
import type { FieldLevel } from "./meta.js";
import { reportContentSchema, reportSchema, type Report, type ReportContent } from "./report.js";

export type StructuralCode =
  | "INVALID_TYPE"
  | "INVALID_ENUM"
  | "UNKNOWN_FIELD"
  | "INVALID_FORMAT"
  | "TOO_MANY_PHOTOS"
  | "NOT_ALLOWED_FOR_SITE_TYPE";

export type MissingCode = "REQUIRED" | "MIN_PHOTOS" | "PHOTO_REQUIRED";

export interface ValidationItem<C extends string> {
  path: string;
  code: C;
}

export interface ValidationResult {
  structuralErrors: ValidationItem<StructuralCode>[];
  missingFields: ValidationItem<MissingCode>[];
}

export interface ValidateOptions {
  siteType: SiteType;
  minPhotosPerReport: number;
  maxPhotosPerReport: number;
  schema?: "content" | "report";
}

interface JsonNode {
  type?: string;
  level?: FieldLevel;
  conditional?: boolean;
  nonEmpty?: boolean;
  properties?: Record<string, JsonNode>;
  items?: JsonNode;
  anyOf?: JsonNode[];
}

function joinPath(parent: string, key: string | number) {
  return parent === "" ? String(key) : `${parent}.${key}`;
}

function mapIssue(issue: z.core.$ZodIssue): ValidationItem<StructuralCode>[] {
  const path = issue.path.map(String).join(".");
  switch (issue.code) {
    case "unrecognized_keys":
      return issue.keys.map((key) => ({ path: joinPath(path, key), code: "UNKNOWN_FIELD" }));
    case "invalid_value":
      return [{ path, code: "INVALID_ENUM" }];
    case "invalid_format":
      return [{ path, code: "INVALID_FORMAT" }];
    default:
      return [{ path, code: "INVALID_TYPE" }];
  }
}

function unwrapNullable(node: JsonNode): JsonNode {
  const inner = node.anyOf?.find((variant) => variant.type !== "null");
  return inner ?? node;
}

function isEmpty(value: unknown) {
  return value === null || value === undefined || value === "";
}

function isEmptyValue(value: unknown) {
  return isEmpty(value) || (Array.isArray(value) && value.length === 0);
}

function walkProperties(
  node: JsonNode,
  data: unknown,
  path: string,
  visit: (prop: JsonNode, value: unknown, path: string) => boolean,
) {
  if (node.properties && typeof data === "object" && data !== null && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    for (const [key, prop] of Object.entries(node.properties)) {
      const value = record[key];
      const propPath = joinPath(path, key);
      if (!visit(prop, value, propPath)) continue;
      descend(prop, value, propPath, visit);
    }
  }
}

function descend(
  prop: JsonNode,
  value: unknown,
  path: string,
  visit: (prop: JsonNode, value: unknown, path: string) => boolean,
) {
  const inner = unwrapNullable(prop);
  if (Array.isArray(value) && inner.items) {
    value.forEach((item: unknown, index) => {
      walkProperties(unwrapNullable(inner.items as JsonNode), item, joinPath(path, index), visit);
    });
    return;
  }
  walkProperties(inner, value, path, visit);
}

function collectNotAllowed(root: JsonNode, data: unknown, siteType: SiteType) {
  const errors: ValidationItem<StructuralCode>[] = [];
  if (siteType !== "private") return errors;
  walkProperties(root, data, "", (prop, value, path) => {
    if (prop.level !== "public_financed") return true;
    if (isEmptyValue(value)) return true;
    errors.push({ path, code: "NOT_ALLOWED_FOR_SITE_TYPE" });
    return false;
  });
  return errors;
}

function collectRequired(root: JsonNode, data: unknown, siteType: SiteType) {
  const missing: ValidationItem<MissingCode>[] = [];
  walkProperties(root, data, "", (prop, value, path) => {
    if (prop.conditional || prop.level === undefined || prop.level === "recommended") return true;
    if (prop.level === "public_financed" && siteType === "private") return false;
    const empty = prop.nonEmpty ? isEmptyValue(value) : isEmpty(value);
    if (empty) {
      missing.push({ path, code: "REQUIRED" });
      return false;
    }
    return true;
  });
  return missing;
}

function collectConditionals(
  data: ReportContent | Report,
  siteType: SiteType,
  options: ValidateOptions,
) {
  const missing: ValidationItem<MissingCode>[] = [];

  data.labor.forEach((entry, index) => {
    if (entry.employment === "third_party" && isEmpty(entry.company)) {
      missing.push({ path: `labor.${index}.company`, code: "REQUIRED" });
    }
  });

  data.occurrences.forEach((occurrence, index) => {
    if (occurrence.type === "accident" && occurrence.safety === null) {
      missing.push({ path: `occurrences.${index}.safety`, code: "REQUIRED" });
    }
    if (occurrence.status === "closed" && occurrence.endTime === null) {
      missing.push({ path: `occurrences.${index}.endTime`, code: "REQUIRED" });
    }
  });

  if ("status" in data && data.status === "approved" && data.approval === null) {
    missing.push({ path: "approval", code: "REQUIRED" });
  }

  if (data.photos.length < options.minPhotosPerReport) {
    missing.push({ path: "photos", code: "MIN_PHOTOS" });
  }

  if (siteType !== "private") {
    const linked = new Set(
      data.photos.flatMap((photo) =>
        photo.linkedTo ? [`${photo.linkedTo.type}:${photo.linkedTo.id}`] : [],
      ),
    );
    data.activities.forEach((activity, index) => {
      if (!linked.has(`activity:${activity.id}`)) {
        missing.push({ path: `activities.${index}`, code: "PHOTO_REQUIRED" });
      }
    });
    data.occurrences.forEach((occurrence, index) => {
      if (!linked.has(`occurrence:${occurrence.id}`)) {
        missing.push({ path: `occurrences.${index}`, code: "PHOTO_REQUIRED" });
      }
    });
  }

  return missing;
}

export function validateReport(input: unknown, options: ValidateOptions): ValidationResult {
  const useReport = options.schema === "report";
  const zodSchema = useReport ? reportSchema : reportContentSchema;
  const jsonSchema = (useReport ? reportJsonSchema : reportContentJsonSchema) as JsonNode;

  const parsed = zodSchema.safeParse(input);
  if (!parsed.success) {
    return { structuralErrors: parsed.error.issues.flatMap(mapIssue), missingFields: [] };
  }

  const structuralErrors = collectNotAllowed(jsonSchema, parsed.data, options.siteType);
  if (parsed.data.photos.length > options.maxPhotosPerReport) {
    structuralErrors.push({ path: "photos", code: "TOO_MANY_PHOTOS" });
  }
  if (structuralErrors.length > 0) return { structuralErrors, missingFields: [] };

  const missingFields = [
    ...collectRequired(jsonSchema, parsed.data, options.siteType),
    ...collectConditionals(parsed.data, options.siteType, options),
  ];
  return { structuralErrors, missingFields };
}
