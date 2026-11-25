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

export const api = createClient<paths>({ baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "" });
api.use(headers);
