import { B, H, approve, approvedDay, call, check, complete, daysAgo, done, entry, generate, randomUUID, site, today } from "./lib.mts";

// ---- getReportPdf
const s = await site("Obra São João \"Q\"");
await entry(s.id, today, 3);
const g = (await generate(s.id, today)).json;
const draftPdf = await call("GET", `/v1/reports/${g.id}/pdf`);
check("pdf de rascunho 409 REPORT_NOT_APPROVED", draftPdf.status === 409 && draftPdf.json?.code === "REPORT_NOT_APPROVED", draftPdf);
check("pdf 409 em problem+json", (draftPdf.headers.get("content-type") ?? "").includes("application/problem+json"), draftPdf.headers.get("content-type"));
check("pdfUrl null no rascunho", g.pdfUrl === null, g.pdfUrl);
await call("PATCH", `/v1/reports/${g.id}`, complete());
const a = await approve(g.id);
check("aprova", a.status === 200, a);
const res = await fetch(`${B}/v1/reports/${g.id}/pdf`, { headers: H });
const bytes = Buffer.from(await res.arrayBuffer());
check("pdf 200", res.status === 200, res.status);
check("pdf content-type", (res.headers.get("content-type") ?? "").startsWith("application/pdf"), res.headers.get("content-type"));
check("pdf começa com %PDF-", bytes.subarray(0, 5).toString("latin1") === "%PDF-", bytes.subarray(0, 8).toString("latin1"));
const [, m, d] = today.split("-");
const disp = res.headers.get("content-disposition") ?? "";
check("nome do arquivo RDO-001_ObraSaoJoaoQ_DD-MM.pdf", disp === `attachment; filename="RDO-001_ObraSaoJoaoQ_${d}-${m}.pdf"`, disp);
check("pdf sem chave 401", (await fetch(`${B}/v1/reports/${g.id}/pdf`)).status === 401);
check("pdf 404", (await call("GET", `/v1/reports/${randomUUID()}/pdf`)).status === 404);
check("pdf id ruim 404", (await call("GET", `/v1/reports/abc/pdf`)).status === 404);
check("pdfUrl aponta pra rota do pdf", a.json.pdfUrl === `${B}/v1/reports/${g.id}/pdf`, a.json.pdfUrl);

// ---- listReports com cursor
const s2 = await site("Lista " + randomUUID().slice(0, 6));
const days = [daysAgo(3), daysAgo(2), daysAgo(1), today];
for (const day of days) await approvedDay(s2.id, day);
const seen: any[] = [];
let cursor: string | null = null;
for (let i = 0; i < 10; i++) {
  const page = await call("GET", `/v1/sites/${s2.id}/reports?status=approved&limit=1${cursor ? `&cursor=${cursor}` : ""}`);
  if (page.status !== 200) { check("página 200", false, page); break; }
  seen.push(...page.json.items);
  if (page.json.items.length !== 1) check(`página ${i} com 1 item`, false, page.json);
  cursor = page.json.nextCursor;
  if (!cursor) break;
}
check("4 páginas, do mais novo pro mais antigo", JSON.stringify(seen.map((r) => r.localDate)) === JSON.stringify([...days].reverse()), seen.map((r) => r.localDate));
check("números 4,3,2,1", JSON.stringify(seen.map((r) => r.number)) === "[4,3,2,1]", seen.map((r) => r.number));
check("campos do item", seen.every((r) => r.status === "approved" && typeof r.approvedAt === "string" && r.occurrencesCount === 0), seen[0]);
const all = await call("GET", `/v1/sites/${s2.id}/reports`);
check("sem limit: tudo e nextCursor null", all.json.items.length === 4 && all.json.nextCursor === null, all.json);
const two = await call("GET", `/v1/sites/${s2.id}/reports?limit=2`);
const two2 = await call("GET", `/v1/sites/${s2.id}/reports?limit=2&cursor=${two.json.nextCursor}`);
check("limit=2: 2 + 2, última com nextCursor null", two.json.items.length === 2 && two2.json.items.length === 2 && two2.json.nextCursor === null, [two.json, two2.json]);
check("limit=0 400", (await call("GET", `/v1/sites/${s2.id}/reports?limit=0`)).status === 400);
check("limit=abc 400", (await call("GET", `/v1/sites/${s2.id}/reports?limit=abc`)).status === 400);
const big = await call("GET", `/v1/sites/${s2.id}/reports?limit=500`);
check("limit=500 200 (limitado a 50)", big.status === 200, big.status);
check("status=draft 400", (await call("GET", `/v1/sites/${s2.id}/reports?status=draft`)).status === 400);
check("cursor lixo 400", (await call("GET", `/v1/sites/${s2.id}/reports?cursor=lixo`)).status === 400);
const badDate = Buffer.from(JSON.stringify({ d: "ontem", id: randomUUID() })).toString("base64url");
const bd = await call("GET", `/v1/sites/${s2.id}/reports?cursor=${badDate}`);
check("cursor com data inválida 400", bd.status === 400, { status: bd.status, body: bd.json });
const badId = Buffer.from(JSON.stringify({ d: today, id: "x" })).toString("base64url");
const bi = await call("GET", `/v1/sites/${s2.id}/reports?cursor=${badId}`);
check("cursor com id inválido 400", bi.status === 400, { status: bi.status, body: bi.json });
check("listReports obra inexistente 404", (await call("GET", `/v1/sites/${randomUUID()}/reports`)).status === 404);
const det = (await call("GET", `/v1/sites/${s2.id}`)).json;
check("getSite: recentReports 3 e count 4", det.recentReports.length === 3 && det.approvedReportsCount === 4 && det.recentReports[0].localDate === today, det.recentReports);
done();
