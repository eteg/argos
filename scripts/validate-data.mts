import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { bundle, createConfig } from "@redocly/openapi-core";
import { validateReport } from "@argos/rdo-schema";
import { z } from "zod";

const problems: string[] = [];
const fail = (where: string, message: string) => problems.push(`${where}: ${message}`);
const read = (path: string): unknown => JSON.parse(readFileSync(path, "utf-8"));

interface OpenApi {
  components: { schemas: Record<string, object> };
  paths: Record<string, Record<string, { requestBody?: { content: Record<string, { schema: object }> } }>>;
}

const bundled = await bundle({
  ref: "docs/contratos/openapi/openapi.yaml",
  config: await createConfig({}),
  dereference: true,
});
const api = bundled.bundle.parsed as unknown as OpenApi;
const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);

function checkSchema(file: string, schema: object, data: unknown) {
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    for (const error of validate.errors ?? []) fail(file, `${error.instancePath || "/"} ${error.message}`);
  }
}

const createSite = api.components.schemas["CreateSiteRequest"];
const equipmentBody =
  api.paths["/v1/sites/{siteId}/equipment"]?.["post"]?.requestBody?.content["application/json"]?.schema;
if (!createSite || !equipmentBody) throw new Error("OpenAPI sem CreateSiteRequest ou addEquipment");

checkSchema("data/demo-site/site.json", createSite, read("data/demo-site/site.json"));
const equipment = read("data/demo-site/equipment.json") as unknown[];
equipment.forEach((item, index) => checkSchema(`data/demo-site/equipment.json[${index}]`, equipmentBody, item));

const csvRows = readFileSync("data/demo-site/services.csv", "utf-8").trim().split("\n");
csvRows.slice(1).forEach((row, index) => {
  const [code, description] = row.split(",");
  if (!code || !description) fail("data/demo-site/services.csv", `linha ${index + 2} sem código ou descrição`);
});

const goldenSchema = z.object({
  day: z.number().int(),
  localDate: z.string(),
  timezone: z.string(),
  entries: z.array(
    z.object({
      capturedAt: z.string(),
      script: z.string(),
      photos: z.array(z.object({ id: z.string(), caption: z.string().nullable(), linkedTo: z.unknown() })),
    }),
  ),
  omittedFields: z.array(z.object({ field: z.string(), expectedQuestion: z.string(), answer: z.string() })).min(1),
  expectedReport: z.record(z.string(), z.unknown()),
});

const siteType = (read("data/demo-site/site.json") as { type: "private" | "public" | "financed" }).type;
const opened = new Map<string, number>();
const closed = new Set<string>();
const kinds = new Set<string>();
const outcomes = new Set<string>();
let accident = false;
let longestOpen = 0;

function getPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value === undefined || value === null) return undefined;
    return (value as Record<string, unknown>)[key];
  }, root);
}

for (let day = 1; day <= 5; day += 1) {
  const file = `data/golden-reports/day-0${day}.json`;
  const parsed = goldenSchema.safeParse(read(file));
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => fail(file, `${issue.path.join(".")} ${issue.message}`));
    continue;
  }
  const golden = parsed.data;
  const report = golden.expectedReport as {
    activities: { id: string; service: { id: string } | null }[];
    occurrences: { id: string; type: string; safety: unknown; affectedServiceIds: string[] }[];
    openItemReviews: { openItemId: string; outcome: string }[];
    newOpenItems: { id: string; kind: string }[];
    photos: { id: string; linkedTo: { type: string; id: string } | null }[];
  };

  const result = validateReport(report, { siteType, minPhotosPerReport: 3, maxPhotosPerReport: 20 });
  result.structuralErrors.forEach((e) => fail(file, `${e.path} ${e.code}`));
  result.missingFields.forEach((e) => fail(file, `${e.path} ${e.code}`));

  golden.omittedFields.forEach((omitted) => {
    if (getPath(report, omitted.field) === undefined) fail(file, `omittedFields aponta pra ${omitted.field}, que não existe`);
  });

  const linkable = new Set([...report.activities.map((a) => `activity:${a.id}`), ...report.occurrences.map((o) => `occurrence:${o.id}`)]);
  report.photos.forEach((photo) => {
    if (photo.linkedTo && !linkable.has(`${photo.linkedTo.type}:${photo.linkedTo.id}`)) fail(file, `foto ${photo.id} aponta pra vínculo inexistente`);
  });
  golden.entries.forEach((entry, index) => {
    if (entry.photos.length > 3) fail(file, `registro ${index} com mais de 3 fotos`);
    entry.photos.forEach((p) => {
      if (!report.photos.some((x) => x.id === p.id)) fail(file, `foto ${p.id} do registro ${index} não está no expectedReport`);
    });
  });

  report.occurrences.forEach((o) => {
    if (o.type === "accident" && o.safety) accident = true;
    o.affectedServiceIds.forEach((id) => {
      if (!report.activities.some((a) => a.service?.id === id) && !id) fail(file, `serviceId ${id} inválido`);
    });
  });

  report.openItemReviews.forEach((review) => {
    const openedOn = opened.get(review.openItemId);
    if (openedOn === undefined) fail(file, `openItemReviews cita ${review.openItemId}, que não nasceu num dia anterior`);
    else if (closed.has(review.openItemId)) fail(file, `openItemReviews cita ${review.openItemId}, já fechado`);
    else if (review.outcome === "close") closed.add(review.openItemId);
    outcomes.add(review.outcome);
    if (openedOn !== undefined && review.outcome !== "close") longestOpen = Math.max(longestOpen, day - openedOn);
  });
  report.newOpenItems.forEach((item) => {
    opened.set(item.id, day);
    kinds.add(item.kind);
  });
}

const requiredKinds = ["declared_pending", "unresolved_occurrence", "unfinished_service"];
requiredKinds.forEach((kind) => !kinds.has(kind) && fail("cobertura", `falta item em aberto ${kind}`));
["close", "keep", "update"].forEach((o) => !outcomes.has(o) && fail("cobertura", `falta desfecho ${o}`));
if (!accident) fail("cobertura", "falta ocorrência accident com safety");
if (longestOpen < 4) fail("cobertura", "nenhum item segue aberto por 4 dias");

if (problems.length > 0) {
  console.error(`${problems.length} problema(s):\n${problems.map((p) => `- ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`ok: obra ${siteType}, 5 gabaritos, itens ${[...kinds].join(", ")}, desfechos ${[...outcomes].join(", ")}, acidente com safety, item aberto por ${longestOpen} dias`);
