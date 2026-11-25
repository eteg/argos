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
