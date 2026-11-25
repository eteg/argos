"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiError, api, currentLocation, timezone, today } from "@/lib/api";

const MAX_PHOTOS = 3;

type Captured = { id: string; blob: Blob; capturedAt: string; preview: string };
type Location = { lat: number; lng: number; accuracyMeters: number } | null;

const ERRORS: Record<string, string> = {
  SITE_NOT_IN_PROGRESS: "A obra não está em andamento.",
  PHOTO_LIMIT_ENTRY: `No máximo ${MAX_PHOTOS} fotos por registro.`,
  PHOTO_LIMIT_REPORT: "O RDO de hoje já chegou a 20 fotos.",
  UNSUPPORTED_FILE: "Esse tipo de arquivo não é aceito.",
};

// 3.2 Registro: um áudio e até 3 fotos, com hora e local carimbados (F1RN01, F1RN02). A IA entra no M2.
export default function NewEntry() {
  const { siteId } = useParams<{ siteId: string }>();
  const router = useRouter();
  const [location, setLocation] = useState<Location>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<(Captured & { durationSeconds: number }) | null>(null);
  const [photos, setPhotos] = useState<Captured[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    currentLocation().then(setLocation);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const stamp = () => {
    const now = new Date().toISOString();
    setStartedAt((s) => s ?? now);
    return now;
  };

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const capturedAt = stamp();
      const begin = Date.now();
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        const blob = new Blob(chunks, { type: rec.mimeType.split(";")[0] || "audio/webm" });
        setAudio({
          id: crypto.randomUUID(),
          blob,
          capturedAt,
          preview: URL.createObjectURL(blob),
          durationSeconds: Math.round((Date.now() - begin) / 1000),
        });
        setRecording(false);
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Não deu pra usar o microfone. Confira a permissão do navegador.");
    }
  }

  function addPhoto(file: File | undefined) {
    if (!file) return;
    if (photos.length >= MAX_PHOTOS) return setError(ERRORS.PHOTO_LIMIT_ENTRY!);
    setPhotos((p) => [...p, { id: crypto.randomUUID(), blob: file, capturedAt: stamp(), preview: URL.createObjectURL(file) }]);
  }

  async function upload(item: Captured, kind: "audio" | "photo", durationSeconds?: number) {
    const form = new FormData();
    form.set("kind", kind);
    form.set("source", kind === "audio" ? "microphone" : "camera");
    form.set("capturedAt", item.capturedAt);
    if (location) form.set("location", JSON.stringify(location));
    if (durationSeconds !== undefined) form.set("durationSeconds", String(durationSeconds));
    form.set("file", item.blob, kind === "audio" ? "audio.webm" : "photo.jpg");
    await api(`/media/${item.id}`, { method: "PUT", body: form });
  }

  async function save() {
    if (!audio && photos.length === 0) return setError("Grave um áudio ou tire uma foto.");
    setSaving(true);
    setError("");
    try {
      if (audio) await upload(audio, "audio", audio.durationSeconds);
      for (const p of photos) await upload(p, "photo");
      await api(`/sites/${siteId}/entries`, {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          capturedAt: startedAt,
          localDate: today(),
          timezone: timezone(),
          location,
          offline: false,
          audioMediaId: audio?.id ?? null,
          photoMediaIds: photos.map((p) => p.id),
        }),
      });
      router.push(`/obras/${siteId}`);
    } catch (e) {
      setError((e instanceof ApiError && ERRORS[e.code]) || "Não deu pra salvar agora. Tente de novo.");
      setSaving(false);
    }
  }

  return (
    <main>
      <Link href={`/obras/${siteId}`} className="muted">
        ← Cancelar
      </Link>
      <h1>Novo registro</h1>
      <p className="muted">
        {location ? `Local carimbado (±${location.accuracyMeters} m)` : "Sem localização"} ·{" "}
        {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>

      <h2>Áudio</h2>
      <button className={`btn block ${recording ? "" : "primary"}`} onClick={toggleRecording} disabled={saving}>
        {recording ? `■ Parar · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : audio ? "🎙 Gravar de novo" : "🎙 Gravar"}
      </button>
      {audio && !recording && <audio controls src={audio.preview} style={{ width: "100%", marginTop: 8 }} />}
      {/* Saída de emergência da demo, quando o microfone não funciona. */}
      {!audio && !recording && (
        <label className="muted" style={{ display: "block", marginTop: 6, textDecoration: "underline", cursor: "pointer" }}>
          Usar um áudio já gravado
          <input
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const preview = URL.createObjectURL(file);
              const el = new Audio(preview);
              el.onloadedmetadata = () =>
                setAudio({ id: crypto.randomUUID(), blob: file, capturedAt: stamp(), preview, durationSeconds: Math.round(el.duration) || 0 });
            }}
          />
        </label>
      )}
      <p className="muted">Conte o que aconteceu: atividades, equipe, clima, ocorrências.</p>

      <h2>
        Fotos · {photos.length} de {MAX_PHOTOS}
      </h2>
      {photos.length > 0 && (
        <div className="photos">
          {photos.map((p) => (
            <img key={p.id} src={p.preview} alt="" onClick={() => setPhotos((all) => all.filter((x) => x.id !== p.id))} />
          ))}
        </div>
      )}
      {photos.length < MAX_PHOTOS && (
        // D10: só câmera, pra foto sempre ter data e local.
        <label className="btn block" style={{ marginTop: 8, color: "var(--text)" }}>
          📷 Tirar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              addPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {error && <p className="error">{error}</p>}
      <div className="fixed-bottom">
        <div>
          <button className="btn primary block" onClick={save} disabled={saving || recording}>
            {saving ? "Salvando…" : "Salvar registro"}
          </button>
        </div>
      </div>
    </main>
  );
}
