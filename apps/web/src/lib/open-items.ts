import type { Schemas } from "@argos/contract";

export const openItemKindLabel: Record<Schemas["OpenItemKind"], string> = {
  declared_pending: "Pendência declarada",
  unresolved_occurrence: "Ocorrência sem desfecho",
  unfinished_service: "Serviço não concluído",
};

export function daysSince(openedOn: string, today: string) {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${openedOn}T00:00:00Z`)) / 86_400_000);
}

export function ageLabel(openedOn: string, today: string) {
  const days = daysSince(openedOn, today);
  if (days <= 0) return "nova";
  if (days === 1) return "desde ontem";
  return `há ${days} dias`;
}

export function agePill(openedOn: string, today: string, highlightDays: number) {
  const days = daysSince(openedOn, today);
  if (days <= 0) return "bg-[#E3ECFF] text-[#0B3699]";
  return days >= highlightDays ? "bg-[#CCA6ED] text-[#2D2D2B]" : "bg-[#F4F5F9] text-[#5B5F6B]";
}

export const localToday = (timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());

export function daysAgo(days: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(Date.now() - days * 86_400_000));
}
