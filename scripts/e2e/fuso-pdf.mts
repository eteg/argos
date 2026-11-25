import { inflateSync } from "node:zlib";
import { B, H, approve, call, check, complete, done, media, randomUUID, site } from "./lib.mts";

// O PDF usa o fuso dos registros do dia, não o de São Paulo (B16).
const TZ = "America/Manaus";
const day = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const s = await site("Fuso " + randomUUID().slice(0, 6));
const photos = [await media("photo"), await media("photo"), await media("photo")];
const e = await call("POST", `/v1/sites/${s.id}/entries`, { id: randomUUID(), capturedAt: new Date().toISOString(), localDate: day, timezone: TZ, audioMediaId: await media("audio"), photoMediaIds: photos });
check("registro em Manaus", e.status === 201, e.json);
const g = (await call("POST", `/v1/sites/${s.id}/days/${day}/report`)).json;
await call("PATCH", `/v1/reports/${g.id}`, complete());
const a = await approve(g.id);
check("aprova", a.status === 200, a.json);

const res = await fetch(`${B}/v1/reports/${g.id}/pdf`, { headers: H });
const pdf = Buffer.from(await res.arrayBuffer());
const texts: string[] = [];
for (const match of pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
  const raw = Buffer.from(match[1]!, "latin1");
  let body = raw.toString("latin1");
  try {
    body = inflateSync(raw).toString("latin1");
  } catch {
    // stream sem compressão
  }
  for (const t of body.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) texts.push(Buffer.from(t[1]!, "hex").toString("latin1"));
}
const at = (iso: string, timeZone: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
const approvedAt = a.json.approval.approvedAt;
const approvedLine = texts.find((t) => t.includes("Rafael Lima") && t.includes(" às ")) ?? "";
check("aprovação no horário de Manaus", approvedLine.endsWith(`às ${at(approvedAt, TZ)}`), { approvedLine, manaus: at(approvedAt, TZ), saoPaulo: at(approvedAt, "America/Sao_Paulo") });
check("e não no de São Paulo", !approvedLine.endsWith(`às ${at(approvedAt, "America/Sao_Paulo")}`), approvedLine);
const photoTime = at(a.json.photos[0].capturedAt, TZ);
check("hora das fotos em Manaus", texts.some((t) => t.startsWith(photoTime)), { photoTime, sample: texts.filter((t) => /^\d\d:\d\d/.test(t)) });
done();
