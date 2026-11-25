import { mkdirSync, writeFileSync } from "node:fs";
import { reportContentJsonSchema, reportJsonSchema } from "../src/json-schema.js";

mkdirSync("dist", { recursive: true });
writeFileSync("dist/report-content.schema.json", JSON.stringify(reportContentJsonSchema, null, 2));
writeFileSync("dist/report.schema.json", JSON.stringify(reportJsonSchema, null, 2));
