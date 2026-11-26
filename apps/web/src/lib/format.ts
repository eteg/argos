import type { Schemas } from "@argos/contract";

export const firstName = (full: string) => full.split(" ")[0] ?? full;

export function greeting(date = new Date()) {
  const hour = date.getHours();
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

export function distanceLabel(meters: number | null, radius: number) {
  if (meters === null) return null;
  const text = meters < 1000 ? `${meters} m` : `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
  return meters <= radius ? `${text} · você está aqui` : text;
}

export const dayStateLabel: Record<string, string> = {
  no_entries: "RDO pendente",
  in_progress: "RDO em andamento",
  draft: "RDO em andamento",
  approved: "RDO aprovado",
};

export const siteTypeLabel: Record<Schemas["SiteType"], string> = {
  private: "obra privada",
  public: "obra pública",
  financed: "obra financiada",
};

export const documentTypeLabel: Record<Schemas["DocumentType"], string> = {
  architectural: "Projeto Arquitetônico",
  structural: "Projeto Estrutural",
  plumbing: "Projeto Hidrossanitário",
  electrical_telecom: "Projeto Elétrico e Telecom",
  hvac: "Projeto de Climatização / HVAC",
  fire_protection: "Projeto de Prevenção Contra Incêndio (PPCI)",
  as_built: "As Built",
};

export const statusLabel: Record<Schemas["SiteStatus"], string> = {
  not_started: "Não iniciada",
  in_progress: "Em andamento",
  paused: "Paralisada",
  completed: "Concluída",
};

export function shortDate(iso: string) {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export function fullDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export const errorText: Record<string, string> = {
  NETWORK: "Sem internet. Tente de novo quando o sinal voltar.",
  VALIDATION: "Confira os campos destacados.",
  UNAUTHORIZED: "O app está mal configurado.",
  NOT_FOUND: "Isso não existe mais.",
  FILE_TOO_LARGE: "O arquivo passa do limite de tamanho.",
  UNSUPPORTED_FILE: "Tipo de arquivo não aceito.",
  SPREADSHEET_UNREADABLE: "A planilha precisa ter as colunas código e descrição.",
  SITE_NOT_IN_PROGRESS: "Só obras em andamento recebem registros.",
  PHOTO_LIMIT_ENTRY: "Cada registro leva no máximo 3 fotos.",
  PHOTO_LIMIT_REPORT: "O dia passaria de 20 fotos.",
  REPORT_ALREADY_APPROVED: "O RDO de hoje já foi aprovado.",
  SITE_HAS_OPEN_REPORTS: "Falta finalizar RDO para concluir a obra.",
  AI_DISABLED: "A IA está desligada agora. Corrija os campos à mão ou responda digitando.",
  PREVIOUS_DAY_PENDING: "Falta aprovar o RDO de um dia anterior antes deste dia.",
};

const joinWithAnd = (items: string[]) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`);

export function errorMessage(code: string, errors: { field: string }[] = []) {
  const days = code === "PREVIOUS_DAY_PENDING" ? errors.map((e) => e.field).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  if (days.length > 0) return `Falta aprovar o RDO de ${joinWithAnd(days.map(shortDate))} antes deste dia.`;
  return errorText[code] ?? "Não deu pra concluir agora. Tente de novo.";
}
