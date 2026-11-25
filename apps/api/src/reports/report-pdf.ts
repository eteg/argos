import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Schemas } from "@argos/contract";

type Report = Schemas["Report"];

const PAGE = { width: 595, height: 842, margin: 42 };
const INK = rgb(0.18, 0.18, 0.17);
const MUTED = rgb(0.36, 0.37, 0.42);
const BLUE = rgb(0.08, 0.39, 1);

const weatherLabel: Record<string, string> = { good: "Bom", cloudy: "Nublado", light_rain: "Chuva fraca", heavy_rain: "Chuva forte" };
const conditionLabel: Record<string, string> = { workable: "praticável", partially_workable: "parcialmente praticável", unworkable: "impraticável" };
const activityLabel: Record<string, string> = { started: "iniciada", in_progress: "em andamento", completed: "concluída", stopped: "parada" };
const equipmentLabel: Record<string, string> = { operating: "operando", stopped: "parado", under_maintenance: "em manutenção" };
const occurrenceLabel: Record<string, string> = {
  stoppage: "Paralisação",
  accident: "Acidente",
  material_shortage: "Falta de material",
  equipment_failure: "Falha de equipamento",
  inspection_order: "Ordem da fiscalização",
  visit: "Visita",
  external_interference: "Interferência externa",
  other: "Outra",
};
const siteTypeLabel: Record<string, string> = { private: "Privada", public: "Pública", financed: "Financiada" };

export interface PdfImage {
  bytes: Uint8Array;
}

const winAnsi = (text: string) => text.replaceAll(/[^ -~\u00a0-\u00ff\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026]/g, "?");
const dateBr = (iso: string) => iso.split("-").reverse().join("/");
const clockBr = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dateTimeBr = (iso: string) => `${new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} às ${clockBr(iso)}`;

export function reportFileName(report: Pick<Report, "number" | "localDate"> & { site: { name: string } }) {
  const name = report.site.name
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  const [, month, day] = report.localDate.split("-");
  return `RDO-${String(report.number).padStart(3, "0")}_${name || "Obra"}_${day}-${month}.pdf`;
}

export async function buildReportPdf(report: Report, loadImage: (mediaId: string) => Promise<PdfImage | null>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const textWidth = PAGE.width - PAGE.margin * 2;
  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;

  const ensure = (height: number) => {
    if (y - height < PAGE.margin) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin;
    }
  };

  const wrap = (text: string, font: PDFFont, size: number, width: number) => {
    const lines: string[] = [];
    for (const paragraph of winAnsi(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(" ")) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > width && line) {
          lines.push(line);
          line = word;
        } else line = test;
      }
      lines.push(line);
    }
    return lines;
  };

  const write = (text: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    for (const line of wrap(text, font, size, textWidth)) {
      ensure(size + 4);
      page.drawText(line, { x: PAGE.margin, y: y - size, size, font, color: opts.color ?? INK });
      y -= size + 4;
    }
  };

  const section = (title: string) => {
    y -= 8;
    ensure(32);
    page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.width - PAGE.margin, y }, thickness: 0.6, color: rgb(0.85, 0.86, 0.9) });
    y -= 6;
    write(title, { font: bold, size: 11, color: BLUE });
  };

  const row = (label: string, value: string) => {
    const labelWidth = 130;
    const lines = wrap(value, regular, 10, textWidth - labelWidth);
    ensure(16);
    page.drawText(winAnsi(label).slice(0, 28), { x: PAGE.margin, y: y - 10, size: 9, font: regular, color: MUTED });
    for (const line of lines) {
      ensure(14);
      page.drawText(line, { x: PAGE.margin + labelWidth, y: y - 10, size: 10, font: regular, color: INK });
      y -= 14;
    }
    if (lines.length === 0) y -= 14;
  };

  write("Relatório Diário de Obra", { font: bold, size: 18 });
  write(report.site.name, { size: 11, color: MUTED });
  write(`Nº ${String(report.number).padStart(3, "0")}  ·  ${dateBr(report.localDate)}  ·  ${report.status === "approved" ? "Aprovado" : "Rascunho"}`, { font: bold, size: 11 });

  section("Identificação");
  row("Tipo", siteTypeLabel[report.site.type] ?? report.site.type);
  row("Endereço", report.site.address);
  row("Contratante", `${report.site.client.name} · CNPJ ${report.site.client.taxId}`);
  row("Contratada", `${report.site.contractor.name} · CNPJ ${report.site.contractor.taxId}`);
  row("Responsável técnico", `${report.site.technicalManager.name} · ART ${report.site.technicalManager.artNumber}`);

  const contract = report.site.publicContract;
  if (contract) {
    const added = contract.amendments.reduce((sum, a) => sum + a.addedDays, 0);
    section("Contrato público");
    row("Contrato", contract.number);
    row("Empenho ou convênio", contract.commitmentOrAgreement);
    row("Fiscal do contrato", contract.inspectorName);
    row("Ordem de serviço", dateBr(contract.serviceOrderDate));
    row("Prazo", `${contract.durationDays} dias${added ? ` + ${added} de aditivos` : " · sem aditivos"}`);
    row("Decorrido", `${contract.elapsedDays} dias · faltam ${contract.remainingDays}`);
  }

  section("Jornada e clima");
  const w = report.workday;
  row("Jornada", w.startTime && w.endTime ? `${w.startTime} às ${w.endTime}${w.breakMinutes !== null ? ` · intervalo ${w.breakMinutes} min` : ""}` : "Não informada");
  for (const shift of report.weather) {
    row(shift.shift === "morning" ? "Manhã" : "Tarde", `${shift.weather ? weatherLabel[shift.weather] : "?"} · ${shift.condition ? conditionLabel[shift.condition] : "?"}`);
  }
  if (report.weatherStoppage) row("Horas paradas por clima", `${report.weatherStoppage.hours} h`);
  if (report.rainfallMm !== null) row("Pluviometria", `${report.rainfallMm} mm`);

  section("Efetivo");
  if (report.labor.length === 0) row("Efetivo", "Não informado");
  for (const l of report.labor) row(l.role, `${l.count} · ${l.employment === "own" ? "Próprio" : `Terceiro${l.company ? ` (${l.company})` : ""}`}`);
  if (report.laborNotes) row("Observações", report.laborNotes);

  if (report.equipment.length > 0) {
    section("Equipamentos");
    for (const e of report.equipment) {
      row(`${e.name}${e.identifier ? ` (${e.identifier})` : ""}`, `${e.status ? equipmentLabel[e.status] : "sem situação"}${e.operatingHours !== null ? ` · ${e.operatingHours} h` : ""}`);
    }
  }

  section("Atividades");
  if (report.activities.length === 0) row("Atividades", "Nenhuma informada");
  for (const a of report.activities) {
    const qty = a.quantity !== null ? ` · ${a.quantity}${a.unit ? ` ${a.unit}` : ""}` : "";
    row(a.service ? a.service.code : "Sem serviço", `${a.description}${a.location ? ` · ${a.location}` : ""} · ${activityLabel[a.status]}${qty}`);
  }

  section("Ocorrências");
  if (report.occurrences.length === 0) row("Ocorrências", "Nenhuma");
  for (const o of report.occurrences) {
    row(occurrenceLabel[o.type] ?? o.type, `${o.description} · ${o.startTime ?? "sem hora"}${o.endTime ? ` às ${o.endTime}` : ""} · ${o.status === "closed" ? "encerrada" : "aberta"}`);
    if (o.source) row("Fonte", `${o.source.origin}${o.source.document ? ` · ${o.source.document}` : ""}`);
    if (o.safety) row("Segurança", `${o.safety.type === "accident" ? "Acidente" : "Incidente"} · DDS ${o.safety.dds ? "feito" : "não feito"} · EPI ${o.safety.ppeInUse ? "em uso" : "sem uso"}`);
  }

  const tracked = report.newOpenItems.filter((n) => n.track);
  if (tracked.length + report.openItemReviews.length > 0) {
    section("Itens em aberto");
    for (const r of report.openItemReviews) row(r.outcome === "close" ? "Fechado" : r.outcome === "keep" ? "Mantido" : "Atualizado", r.note ?? r.openItemId);
    for (const n of tracked) row("Novo", n.title);
  }

  if (report.photos.length > 0) {
    section(`Fotos · ${report.photos.length} de 20`);
    const cell = (textWidth - 12) / 2;
    const imageHeight = 130;
    for (let i = 0; i < report.photos.length; i += 2) {
      ensure(imageHeight + 34);
      const top = y;
      for (const [col, photo] of report.photos.slice(i, i + 2).entries()) {
        const x = PAGE.margin + col * (cell + 12);
        const loaded = await loadImage(photo.id);
        let drawn = false;
        if (loaded) {
          try {
            const isPng = loaded.bytes[0] === 0x89;
            const image = isPng ? await doc.embedPng(loaded.bytes) : await doc.embedJpg(loaded.bytes);
            const scale = Math.min(cell / image.width, imageHeight / image.height);
            page.drawImage(image, { x, y: top - imageHeight, width: image.width * scale, height: image.height * scale });
            drawn = true;
          } catch {
            drawn = false;
          }
        }
        if (!drawn) page.drawRectangle({ x, y: top - imageHeight, width: cell, height: imageHeight, color: rgb(0.86, 0.87, 0.91) });
        const caption = `${clockBr(photo.capturedAt)}${photo.caption ? ` · ${photo.caption}` : ""}`;
        page.drawText(winAnsi(caption).slice(0, 70), { x, y: top - imageHeight - 12, size: 8, font: regular, color: MUTED });
      }
      y = top - imageHeight - 22;
    }
  }

  section("Validação");
  row("Status", report.status === "approved" ? "Aprovado" : "Rascunho");
  if (report.approval) row("Aprovado por", `${report.approval.approvedBy} · ${dateTimeBr(report.approval.approvedAt)}`);
  if (report.history.length > 0) {
    y -= 4;
    write("Histórico de alterações", { font: bold, size: 10 });
    for (const h of report.history) write(`${dateTimeBr(h.at)} · ${h.actor === "agent" ? "Argos" : "Engenheiro"}: ${h.description}`, { size: 9, color: MUTED });
  }

  return doc.save();
}
