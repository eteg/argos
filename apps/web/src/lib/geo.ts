export interface Position {
  lat: number;
  lng: number;
  accuracyMeters: number;
}

let cached: Promise<Position | null> | null = null;

export function getPosition(fresh = false): Promise<Position | null> {
  if (cached && !fresh) return cached;
  cached = new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyMeters: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60_000 },
    );
  });
  return cached;
}

export const deviceHeader = (p: Position | null) => (p ? { "X-Device-Location": `${p.lat},${p.lng}` } : {});
