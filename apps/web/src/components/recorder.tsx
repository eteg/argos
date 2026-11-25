"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, timezoneParams } from "@/lib/api";
import { clock, errorMessage } from "@/lib/format";
import { getPosition, type Position } from "@/lib/geo";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { useOnline } from "@/lib/online";
import { sendEntry, type CapturedFile } from "@/lib/send-entry";
import { Understood } from "@/components/understood";

const localDateNow = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

export function Recorder() {
  const siteId = useSearchParams().get("id") ?? "";
  const online = useOnline();
  const timezone = timezoneParams().header["X-Timezone"];
  const [info] = useLoad(async () => {
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
  const [savedId, setSavedId] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
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

  const resolved =
    info.status === "ok"
      ? { maxPhotos: info.data.maxPhotos, siteName: info.data.site.name, count: info.data.count }
      : info.status === "error"
        ? { maxPhotos: 3, siteName: "esta obra", count: 0 }
        : null;

  async function save() {
    if (!audio || !resolved) return;
    setSaving(true);
    setError(null);
    try {
      const result = await sendEntry({
        id: entryId.current, siteId, siteName: resolved.siteName, capturedAt: startedAt.current, localDate: localDateNow(timezone), timezone, location: position,
        audio: { ...audio, durationSeconds: seconds }, photos,
      });
      if (result.kind === "sent") setSavedId(result.entry.id);
      else setQueued(true);
    } catch (e) {
      setError(errorMessage(e instanceof ApiError ? e.code : "UNAVAILABLE"));
      setSaving(false);
    }
  }

  if (queued) return <SavedOffline siteId={siteId} number={(resolved?.count ?? 0) + 1} />;
  if (savedId) return <Understood entryId={savedId} siteId={siteId} number={(resolved?.count ?? 0) + 1} />;
  if (!resolved) {
    return <main className="mx-auto min-h-dvh max-w-[430px] bg-[#2D2D2B] p-6 text-white">Carregando…</main>;
  }
  const { maxPhotos, siteName, count } = resolved;
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#2D2D2B] font-[family-name:var(--font-inter)] text-white">
      <div className="flex items-center justify-between px-[18px] pt-[18px]">
        <Link href={`/obra?id=${siteId}`} aria-label="Cancelar registro" className="flex size-11 items-center justify-center rounded-full bg-[#3A3A37]">✕</Link>
        <span className="flex-1" />
        {!online && <span className="mr-2 flex items-center gap-1.5 rounded-full bg-[#FFE9C7] px-3 py-2 text-[13px] font-semibold text-[#6B3A00]">Sem internet</span>}
        {phase === "recording" && <span className="flex items-center gap-2 rounded-full bg-[#3A3A37] px-3 py-2 text-[13px]"><span className="size-2 rounded-full bg-[#CCA6ED]" />Gravando · {clock(seconds)}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-4 px-4 pb-3 pt-[18px]">
        <div className="flex flex-col gap-0.5 px-1">
          <span className="text-[15px] font-semibold">{time} · {siteName}</span>
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
        {!online && (
          <>
            <div className="flex flex-col gap-2.5 rounded-[18px] bg-[#3A3A37] px-4 py-3.5">
              <span className="text-[15px] font-semibold">Salvando só no celular</span>
              <p className="m-0 text-sm leading-[1.5] text-[#E8E8E4]">Sem sinal, o Argos guarda o áudio e as fotos. Quando a internet voltar, ele envia, preenche o RDO e faz as perguntas do que faltou.</p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-[#6E6E69] px-4 py-3.5">
              <span className="text-xs text-[#CFCFCB]">Transcrição, perguntas da IA e pendências de ontem</span>
              <span className="text-sm text-[#E8E8E4]">Aparecem quando o sinal voltar.</span>
            </div>
          </>
        )}
        {error && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{error}</div>}
      </div>
      <div className="px-4 pb-6 pt-3">
        <button type="button" disabled={!audio || saving || phase === "recording"} onClick={() => void save()} className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#1563FF] text-[15px] font-semibold disabled:bg-[#3A3A37] disabled:text-[#8A8A85]">
          {saving ? "Salvando…" : online ? "Salvar registro" : "Parar e salvar"}
        </button>
      </div>
    </main>
  );
}

function SavedOffline({ siteId, number }: { siteId: string; number: number }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#2D2D2B] font-[family-name:var(--font-inter)] text-white">
      <div className="flex flex-col gap-4 px-4 pb-3 pt-6">
        <div className="flex flex-col gap-0.5 px-1">
          <span className="text-[15px] font-semibold">Registro {number} guardado no celular</span>
          <span className="text-[13px] text-[#CFCFCB]">Hora e local carimbados</span>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[18px] bg-[#3A3A37] px-4 py-3.5">
          <span className="text-[15px] font-semibold">Salvando só no celular</span>
          <p className="m-0 text-sm leading-[1.5] text-[#E8E8E4]">Quando a internet voltar, o Argos envia o áudio e as fotos, preenche o RDO e faz as perguntas do que faltou. Você recebe um aviso.</p>
        </div>
      </div>
      <div className="mt-auto flex gap-2.5 px-4 pb-6 pt-3">
        <a href={`/registro?id=${siteId}`} className="flex h-[52px] flex-1 items-center justify-center rounded-2xl bg-[#3A3A37] text-[15px] font-semibold">Novo registro</a>
        <Link href={`/obra?id=${siteId}`} className="flex h-[52px] flex-1 items-center justify-center rounded-2xl bg-[#1563FF] text-[15px] font-semibold">Voltar à obra</Link>
      </div>
    </main>
  );
}
