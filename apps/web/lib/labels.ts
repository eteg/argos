export const siteTypeLabel = { private: "obra privada", public: "obra pública", financed: "obra financiada" } as const;
export const siteStatusLabel = {
  not_started: "Não iniciada",
  in_progress: "Em andamento",
  paused: "Paralisada",
  completed: "Concluída",
} as const;

export const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const date = (ymd: string) => ymd.split("-").reverse().join("/");
export const distance = (m: number | null) =>
  m === null ? null : m <= 150 ? `${m} m · você está aqui` : m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;

export const weatherLabel: Record<string, string> = { good: "Bom", cloudy: "Nublado", light_rain: "Chuva fraca", heavy_rain: "Chuva forte" };
export const conditionLabel: Record<string, string> = {
  workable: "praticável",
  partially_workable: "parcialmente praticável",
  unworkable: "impraticável",
};
export const equipmentStatusLabel: Record<string, string> = { operating: "Operando", stopped: "Parado", under_maintenance: "Em manutenção" };
export const activityStatusLabel: Record<string, string> = {
  started: "iniciada",
  in_progress: "em andamento",
  completed: "concluída",
  stopped: "paralisada",
};
export const occurrenceTypeLabel: Record<string, string> = {
  stoppage: "Paralisação",
  accident: "Acidente",
  material_shortage: "Falta de material",
  equipment_failure: "Falha de equipamento",
  inspection_order: "Ordem da fiscalização",
  visit: "Visita",
  external_interference: "Interferência externa",
  other: "Outra",
};

export const openItemKindLabel: Record<string, string> = {
  declared_pending: "Pendência declarada",
  unresolved_occurrence: "Ocorrência sem desfecho",
  unfinished_service: "Serviço não concluído",
};
export const outcomeLabel: Record<string, string> = { close: "Fechar", keep: "Manter", update: "Atualizar" };

// F1RN10: item antigo ganha destaque a partir de 4 dias (D03).
export const HIGHLIGHT_DAYS = 4;
export const daysSince = (ymd: string, today: string) => Math.round((Date.parse(today) - Date.parse(ymd)) / 86_400_000);
export const age = (days: number) => (days <= 0 ? "nova" : days === 1 ? "há 1 dia" : `há ${days} dias`);
