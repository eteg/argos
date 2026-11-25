import { api, timezoneParams } from "@/lib/api";
import { unwrap } from "@/lib/hooks";
import type { Position } from "@/lib/geo";

export interface CapturedFile {
  id: string;
  blob: Blob;
  capturedAt: string;
  durationSeconds?: number;
}

export interface EntryDraft {
  id: string;
  siteId: string;
  capturedAt: string;
  localDate: string;
  timezone: string;
  location: Position | null;
  audio: CapturedFile;
  photos: CapturedFile[];
}

async function uploadFile(file: CapturedFile, kind: "audio" | "photo", location: Position | null) {
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

export async function sendEntry(draft: EntryDraft) {
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
        ...(draft.location ? { location: draft.location } : {}),
        audioMediaId: draft.audio.id,
        photoMediaIds: draft.photos.map((p) => p.id),
      },
    }),
  );
}
