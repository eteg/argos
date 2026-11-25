const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

// Toda chamada leva a chave da API (ADR 0002). Vira cliente openapi-fetch quando o OpenAPI do M1 existir.
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}/v1${path}`, {
    ...init,
    headers: { "X-Api-Key": process.env.NEXT_PUBLIC_API_KEY ?? "", ...init?.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}
