"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, timezoneParams } from "@/lib/api";
import { clock, errorMessage } from "@/lib/format";
import { getPosition, type Position } from "@/lib/geo";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { sendEntry, type CapturedFile } from "@/lib/send-entry";

const localDateNow = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

export function Recorder() {
  const router = useRouter();
  const siteId = useSearchParams().get("id") ?? "";
  const timezone = timezoneParams().header["X-Timezone"];
  const [info, retry] = useLoad(async () => {
    const [config, site] = await Promise.all([
      unwrap(api.GET("/v1/config", { params: timezoneParams() })),
      unwrap(api.GET("/v1/sites/{siteId}", { params: { path: { siteId }, ...timezoneParams() } })),
    ]);
    const day = await unwrap(api.GET("/v1/sites/{siteId}/days/{localDate}", { params: { path: { siteId, localDate: site.today.localDate }, ...timezoneParams() } }));
    return { maxPhotos: config.maxPhotosPerEntry, site, count: day.entries.length };
  }, [siteId]);

  const [position, setPosition] = useState<Position | null>(null);
  const [phase, setPhase] = useState<"idle" | "recording" | "recorded">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<CapturedFile | null>(null);
  const [photos, setPhotos] = useState<(CapturedFile & { preview: string })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef("");
  const entryId = useRef(crypto.randomUUID());

  useEffect(() => { void getPosition(true).then(setPosition); }, []);
  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        setAudio({ id: crypto.randomUUID(), blob, capturedAt: startedAt.current, durationSeconds: 0 });
        setPhase("recorded");
      };
      startedAt.current = new Date().toISOString();
      recorder.current = rec;
      setSeconds(0);
      rec.start();
      setPhase("recording");
    } catch {
      setError("Não deu pra acessar o microfone. Libere a permissão e tente de novo.");
    }
  }

  function stop() {
    recorder.current?.stop();
  }

  function addPhoto(file: File | undefined, max: number) {
    if (!file || photos.length >= max) return;
    setPhotos((l) => [...l, { id: crypto.randomUUID(), blob: file, capturedAt: new Date().toISOString(), preview: URL.createObjectURL(file) }]);
  }

  async function save() {
    if (!audio || !info.status || info.status !== "ok") return;
    setSaving(true);
    setError(null);
    try {
      await sendEntry({
        id: entryId.current, siteId, capturedAt: startedAt.current, localDate: localDateNow(timezone), timezone, location: position,
        audio: { ...audio, durationSeconds: seconds }, photos,
      });
      router.push(`/obra?id=${siteId}`);
    } catch (e) {
      setError(errorMessage(e instanceof ApiError ? e.code : "UNAVAILABLE"));
      setSaving(false);
    }
  }

  if (info.status !== "ok") {
    return <main className="mx-auto min-h-dvh max-w-[430px] bg-[#2D2D2B] p-6 text-white">{info.status === "loading" ? "Carregando…" : <button type="button" onClick={retry}>Não deu pra carregar. Tentar de novo</button>}</main>;
  }
  const { maxPhotos, site, count } = info.data;
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#2D2D2B] font-[family-name:var(--font-inter)] text-white">
      <div className="flex items-center justify-between px-[18px] pt-[18px]">
        <Link href={`/obra?id=${siteId}`} aria-label="Cancelar registro" className="flex size-11 items-center justify-center rounded-full bg-[#3A3A37]">✕</Link>
        {phase === "recording" && <span className="flex items-center gap-2 rounded-full bg-[#3A3A37] px-3 py-2 text-[13px]"><span className="size-2 rounded-full bg-[#CCA6ED]" />Gravando · {clock(seconds)}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-4 px-4 pb-3 pt-[18px]">
        <div className="flex flex-col gap-0.5 px-1">
          <span className="text-[15px] font-semibold">{time} · {site.name}</span>
          <span className="text-[13px] text-[#CFCFCB]">Registro {count + 1} de hoje · hora e local carimbados{position ? "" : " (sem localização)"}</span>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#3A3A37] px-4 py-8">
          {phase === "idle" && <button type="button" onClick={() => void start()} className="flex size-24 items-center justify-center rounded-full bg-[#1563FF] text-sm font-semibold">Gravar</button>}
          {phase === "recording" && <button type="button" onClick={stop} className="flex size-24 items-center justify-center rounded-full bg-[#CCA6ED] text-sm font-semibold text-[#2D2D2B]">Parar</button>}
          {phase === "recorded" && audio && (
            <>
              <span className="text-[15px] font-semibold">Áudio · {clock(seconds)}</span>
              <audio controls src={URL.createObjectURL(audio.blob)} className="w-full" />
              <button type="button" onClick={() => { setAudio(null); setPhase("idle"); setSeconds(0); }} className="text-[13px] text-[#CCA6ED]">Gravar de novo</button>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between px-1 text-[13px] text-[#CFCFCB]"><span>Fotos deste registro</span><span>{photos.length} de {maxPhotos} neste registro</span></div>
          <div className="flex gap-2 overflow-x-auto">
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.preview} alt="Foto do registro" className="size-[76px] flex-none rounded-xl object-cover" />
            ))}
            {photos.length < maxPhotos && (
              <label className="flex size-[76px] flex-none cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-[#8A8A85] text-xs text-[#CFCFCB]">
                Foto
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { addPhoto(e.target.files?.[0], maxPhotos); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>
        {error && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{error}</div>}
      </div>
      <div className="px-4 pb-6 pt-3">
        <button type="button" disabled={!audio || saving || phase === "recording"} onClick={() => void save()} className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#1563FF] text-[15px] font-semibold disabled:bg-[#3A3A37] disabled:text-[#8A8A85]">
          {saving ? "Salvando…" : "Salvar registro"}
        </button>
      </div>
    </main>
  );
}
