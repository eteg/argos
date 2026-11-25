const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly problem: Record<string, unknown>,
  ) {
    super(`${status} ${code}`);
  }
}

export const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: timezone() }).format(new Date());
export const mediaUrl = (path: string) => `${baseUrl}${path}`;

// Toda chamada leva a chave da API (ADR 0002) e o fuso do celular. Vira cliente openapi-fetch quando o OpenAPI do M1 existir.
export async function api<T>(path: string, init?: RequestInit & { location?: { lat: number; lng: number } | null }): Promise<T> {
  const headers: Record<string, string> = { "X-Api-Key": process.env.NEXT_PUBLIC_API_KEY ?? "", "X-Timezone": timezone() };
  if (init?.body && typeof init.body === "string") headers["Content-Type"] = "application/json";
  if (init?.location) headers["X-Device-Location"] = `${init.location.lat},${init.location.lng}`;
  const res = await fetch(`${baseUrl}/v1${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    throw new ApiError(res.status, problem.code ?? "UNAVAILABLE", problem);
  }
  return res.json() as Promise<T>;
}

export function currentLocation(): Promise<{ lat: number; lng: number; accuracyMeters: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyMeters: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60_000 },
    );
  });
}

export type SiteType = "private" | "public" | "financed";
export type SiteStatus = "not_started" | "in_progress" | "paused" | "completed";

export interface Media {
  id: string;
  kind: "audio" | "photo";
  capturedAt: string;
  durationSeconds: number | null;
  url: string;
}

export interface Entry {
  id: string;
  capturedAt: string;
  audio: Media | null;
  photos: Media[];
  status: "processing" | "processed" | "failed";
  title: string | null;
  transcript: string | null;
  tags: { kind: string; label: string }[];
}

export interface Question {
  id: string;
  kind: string;
  text: string;
  field: string | null;
}

export interface Report {
  id: string;
  siteId: string;
  number: number;
  localDate: string;
  status: "generating" | "draft" | "approved" | "failed";
  entriesCount: number;
  site: { name: string; type: SiteType; address: string | null };
  workday?: { startTime: string | null; endTime: string | null; breakMinutes: number | null };
  weather?: { shift: "morning" | "afternoon"; weather: string | null; condition: string | null }[];
  weatherStoppage?: { hours: number | null; serviceIds: string[] } | null;
  labor?: { role: string; count: number | null; employment: string | null; company: string | null }[];
  equipment?: { name: string; status: string | null }[];
  activities?: { id: string; description: string; location: string | null; status: string | null; quantity: number | null; unit: string | null }[];
  occurrences?: { id: string; type: string; description: string; startTime: string | null; endTime: string | null; status: string | null }[];
  photos: { id: string; url: string }[];
  questions: Question[];
  missingFields: { field: string; questionId: string | null }[];
  approval: { approvedBy: string; approvedAt: string } | null;
  history: { at: string; actor: string; description: string }[];
}

export interface SiteSummary {
  id: string;
  name: string;
  type: SiteType;
  status: SiteStatus;
  statusChangedOn: string;
  address: string | null;
  distanceMeters: number | null;
  today: { localDate: string; state: string; entriesCount: number };
}

export interface Site extends SiteSummary {
  client: { name: string; taxId: string | null } | null;
  contractor: { name: string; taxId: string | null } | null;
  technicalManager: { name: string; artNumber: string | null } | null;
  publicContract: { number: string; durationDays: number; elapsedDays: number; remainingDays: number } | null;
  equipment: { id: string; name: string; identifier: string | null }[];
}
