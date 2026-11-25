import type { paths } from "@argos/contract";
import createClient, { type Middleware } from "openapi-fetch";

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const timezoneParams = () => ({ header: { "X-Timezone": timezone() } });

const headers: Middleware = {
  onRequest({ request }) {
    request.headers.set("X-Api-Key", process.env.NEXT_PUBLIC_API_KEY ?? "");
    request.headers.set("X-Timezone", timezone());
    return request;
  },
};

const CACHE_PREFIX = "argos:get:";
export const CACHE_HEADER = "x-argos-cache";

function readCache(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeCache(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // cheio ou bloqueado: a leitura sem internet só fica sem esse item
  }
}

// Sem internet, um GET devolve a última resposta carregada daquela URL.
async function cachedFetch(request: Request): Promise<Response> {
  const key = request.method === "GET" ? CACHE_PREFIX + request.url : null;
  try {
    const response = await fetch(request);
    if (key && response.ok && response.headers.get("content-type")?.includes("json")) {
      writeCache(key, await response.clone().text());
    }
    return response;
  } catch (error) {
    const hit = key ? readCache(key) : null;
    if (hit) return new Response(hit, { status: 200, headers: { "content-type": "application/json", [CACHE_HEADER]: "1" } });
    throw error;
  }
}

export const api = createClient<paths>({ baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "", fetch: cachedFetch });
api.use(headers);
