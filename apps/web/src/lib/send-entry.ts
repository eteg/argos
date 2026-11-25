import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { ApiError, unwrap } from "@/lib/hooks";
import type { Position } from "@/lib/geo";
import { enqueueEntry, listQueue, removeQueued, type QueuedEntry } from "@/lib/offline-queue";

export interface CapturedFile {
  id: string;
  blob: Blob;
  capturedAt: string;
  durationSeconds?: number;
}

export interface EntryDraft {
  id: string;
  siteId: string;
  siteName: string;
  capturedAt: string;
  localDate: string;
  timezone: string;
  location: Position | null;
  audio: CapturedFile;
  photos: CapturedFile[];
}

export type SendResult = { kind: "sent"; entry: Schemas["Entry"] } | { kind: "queued"; reason: "offline" | "failed" };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function uploadFile(file: CapturedFile, kind: "audio" | "photo", location: Position | null) {
  const form = new FormData();
  form.append("file", file.blob, kind === "audio" ? "audio" : "photo");
  form.append("kind", kind);
  form.append("source", kind === "audio" ? "microphone" : "camera");
  form.append("capturedAt", file.capturedAt);
  if (file.durationSeconds !== undefined) form.append("durationSeconds", String(file.durationSeconds));
  if (location) form.append("location", JSON.stringify(location));
  await unwrap(
    api.PUT("/v1/media/{mediaId}", {
      params: { path: { mediaId: file.id }, ...timezoneParams() },
      body: {} as never,
      bodySerializer: () => form,
    }),
  );
}

async function post(draft: EntryDraft, offline: boolean) {
  await uploadFile(draft.audio, "audio", draft.location);
  for (const photo of draft.photos) await uploadFile(photo, "photo", draft.location);
  return unwrap(
    api.POST("/v1/sites/{siteId}/entries", {
      params: { path: { siteId: draft.siteId }, ...timezoneParams() },
      body: {
        id: draft.id,
        capturedAt: draft.capturedAt,
        localDate: draft.localDate,
        timezone: draft.timezone,
        offline,
        ...(draft.location ? { location: draft.location } : {}),
        audioMediaId: draft.audio.id,
        photoMediaIds: draft.photos.map((p) => p.id),
      },
    }),
  );
}

// Único ponto de envio do registro. Com internet manda direto, tentando de novo se a rede oscilar; sem internet
// (ou se continuar falhando) guarda no celular e a fila sobe depois, com os mesmos ids (envio idempotente).
// O registro só conta como "capturado sem internet" se de fato não havia internet na captura.
export async function sendEntry(draft: EntryDraft): Promise<SendResult> {
  const wasOnline = navigator.onLine;
  if (wasOnline) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return { kind: "sent", entry: await post(draft, false) };
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== "NETWORK") throw error;
        console.warn(`Envio do registro falhou (tentativa ${attempt + 1}/3)`);
        await wait(1000 * (attempt + 1));
      }
    }
  }
  await enqueueEntry({ ...draft, queuedAt: new Date().toISOString(), offline: !wasOnline });
  return { kind: "queued", reason: wasOnline ? "failed" : "offline" };
}

export interface FlushResult {
  sent: { siteId: string; siteName: string; localDate: string }[];
  failed: number;
}

let flushing: Promise<FlushResult> | null = null;

async function flush(): Promise<FlushResult> {
  const result: FlushResult = { sent: [], failed: 0 };
  for (const item of await listQueue()) {
    if (item.error) continue;
    try {
      await post(item, item.offline ?? true);
      await removeQueued(item.id);
      result.sent.push({ siteId: item.siteId, siteName: item.siteName, localDate: item.localDate });
    } catch (error) {
      if (!(error instanceof ApiError) || error.code === "NETWORK" || error.code === "UNAVAILABLE") break;
      // 4xx de regra (obra parada, RDO já aprovado, obra apagada): não adianta tentar de novo
      await enqueueEntry({ ...item, error: error.code } satisfies QueuedEntry);
      result.failed += 1;
    }
  }
  return result;
}

export async function retryFailed(): Promise<FlushResult> {
  for (const item of await listQueue()) {
    if (item.error) await enqueueEntry({ ...item, error: undefined });
  }
  return flushQueue();
}

export function flushQueue(): Promise<FlushResult> {
  flushing ??= flush().finally(() => {
    flushing = null;
  });
  return flushing;
}
