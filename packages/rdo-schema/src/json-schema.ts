import { z } from "zod";
import { reportContentSchema, reportSchema } from "./report.js";

export const reportContentJsonSchema = z.toJSONSchema(reportContentSchema);
export const reportJsonSchema = z.toJSONSchema(reportSchema);
