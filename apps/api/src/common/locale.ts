import { ProblemException } from "./problem.js";

export function timezoneOf(header: string | undefined) {
  const timezone = header ?? "America/Sao_Paulo";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    throw new ProblemException(400, "VALIDATION", "Invalid X-Timezone.", [{ field: "X-Timezone", code: "INVALID" }]);
  }
  return timezone;
}

export function localDateOf(instant: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(instant);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function parseDeviceLocation(header: string | undefined) {
  if (!header) return null;
  const [lat, lng] = header.split(",").map(Number);
  if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}
