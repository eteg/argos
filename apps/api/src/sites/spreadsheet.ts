import { readSheet } from "read-excel-file/node";
import { ProblemException } from "../common/problem.js";

export interface ServiceRow {
  code: string;
  description: string;
  unit: string | null;
}

const aliases = {
  code: ["code", "codigo", "item", "cod"],
  description: ["description", "descricao", "servico", "discriminacao"],
  unit: ["unit", "unidade", "un", "und"],
};

const cell = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value).trim() : "");

const normalize = (value: unknown) =>
  cell(value).normalize("NFD").replaceAll(/[̀-ͯ]/g, "").trim().toLowerCase();

function parseCsv(text: string): string[][] {
  const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r?\n/).filter((line) => line.trim() !== "");
  const first = lines[0] ?? "";
  const delimiter = first.split(";").length > first.split(",").length ? ";" : ",";
  return lines.map((line) => {
    const cells: string[] = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i]!;
      if (char === '"') {
        if (quoted && line[i + 1] === '"') cell += (i++, '"');
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(cell);
        cell = "";
      } else cell += char;
    }
    cells.push(cell);
    return cells;
  });
}

export async function readServices(file: Buffer, fileName: string): Promise<ServiceRow[]> {
  let rows: unknown[][];
  try {
    rows = fileName.toLowerCase().endsWith(".csv") ? parseCsv(file.toString("utf8")) : await readSheet(file);
  } catch {
    throw unreadable();
  }
  const headerIndex = rows.findIndex((row) => row.some((c) => aliases.code.includes(normalize(c))));
  const header = rows[headerIndex]?.map(normalize);
  const find = (names: string[]) => header?.findIndex((h) => names.includes(h)) ?? -1;
  const [codeAt, descriptionAt, unitAt] = [find(aliases.code), find(aliases.description), find(aliases.unit)];
  if (codeAt < 0 || descriptionAt < 0) throw unreadable();
  const services = rows
    .slice(headerIndex + 1)
    .map((row) => ({
      code: cell(row[codeAt]),
      description: cell(row[descriptionAt]),
      unit: unitAt >= 0 ? cell(row[unitAt]) || null : null,
    }))
    .filter((s) => s.code && s.description);
  if (services.length === 0) throw unreadable();
  return services;
}

function unreadable() {
  return new ProblemException(422, "SPREADSHEET_UNREADABLE", "The spreadsheet has no code and description columns.");
}
