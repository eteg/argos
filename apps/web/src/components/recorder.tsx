"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, timezoneParams } from "@/lib/api";
import { clock, errorMessage } from "@/lib/format";
import { getPosition, type Position } from "@/lib/geo";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { useOnline } from "@/lib/online";
import { sendEntry, type CapturedFile } from "@/lib/send-entry";
import { Understood } from "@/components/understood";

const BARS = [16, 34, 52, 28, 60, 22, 44, 64, 38, 20, 48, 30, 56, 18, 40, 26, 50, 24];

function Waveform({ height }: { height: number }) {
  return (
    <div aria-hidden="true" className="flex items-center justify-center gap-1" style={{ height }}>
      {BARS.map((h, i) => <span key={i} className="w-[5px] rounded-[3px] bg-[#CCA6ED]" style={{ height: h }} />)}
    </div>
  );
}

const CameraIcon = ({ size = 20, color = "#FFFFFF" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
);

const localDateNow = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

export function Recorder() {
  const router = useRouter();
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
  const pendingSave = useRef<"save" | "close" | null>(null);

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

  async function save(closeDay = false) {
    if (!audio || !resolved) return;
    setSaving(true);
    setError(null);
    try {
      const result = await sendEntry({
        id: entryId.current, siteId, siteName: resolved.siteName, capturedAt: startedAt.current, localDate: localDateNow(timezone), timezone, location: position,
        audio: { ...audio, durationSeconds: seconds }, photos,
      });
      if (result.kind === "sent" && closeDay) {
        const report = await unwrap(api.POST("/v1/sites/{siteId}/days/{localDate}/report", { params: { path: { siteId, localDate: localDateNow(timezone) }, ...timezoneParams() } }));
        router.push(`/rdo?id=${report.id}`);
      } else if (result.kind === "sent") setSavedId(result.entry.id);
      else setQueued(true);
    } catch (e) {
      setError(errorMessage(e instanceof ApiError ? e.code : "UNAVAILABLE"));
      setSaving(false);
    }
  }

  useEffect(() => {
    if (phase !== "recorded" || !pendingSave.current) return;
    const mode = pendingSave.current;
    pendingSave.current = null;
    void save(mode === "close");
  });

  if (queued) return <SavedOffline siteId={siteId} number={(resolved?.count ?? 0) + 1} />;
  if (savedId) return <Understood entryId={savedId} siteId={siteId} number={(resolved?.count ?? 0) + 1} />;
  if (!resolved) {
    return <main className="mx-auto min-h-dvh max-w-[430px] bg-[#2D2D2B] p-6 text-white">Carregando…</main>;
  }
  const { maxPhotos, siteName, count } = resolved;
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const offline = !online;
  const label = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const photoInput = (
    <input type="file" accept="image/*" capture="environment" disabled={photos.length >= maxPhotos} className="sr-only" onChange={(e) => { addPhoto(e.target.files?.[0], maxPhotos); e.target.value = ""; }} />
  );
  const blocked = saving || phase === "idle";

  function stopAndSave() {
    if (phase === "recording") {
      pendingSave.current = "save";
      stop();
      return;
    }
    void save();
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[430px] flex-col bg-[#2D2D2B] font-[family-name:var(--font-inter)] text-white">
      <div className="flex items-center px-[18px] pt-[18px]">
        <Link href={`/obra?id=${siteId}`} aria-label="Cancelar registro" className="flex size-11 items-center justify-center rounded-full bg-[#3A3A37]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </Link>
        <span className="flex-1" />
        {offline && (
          <span className="mr-2 flex items-center gap-1.5 rounded-full bg-[#FFE9C7] px-3 py-[7px] text-[13px] font-semibold text-[#6B3A00]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B3A00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M5 12.9a10 10 0 0 1 5.2-2.7" /><path d="M19 12.9a10 10 0 0 0-2.4-1.6" /><circle cx="12" cy="20" r="0.8" /></svg>
            Sem internet
          </span>
        )}
        {phase === "recording" && <span className="flex items-center gap-2 rounded-full bg-[#3A3A37] px-[13px] py-[7px] text-[13px]"><span className="size-2 rounded-full bg-[#CCA6ED]" />Gravando · {clock(seconds)}</span>}
      </div>
      <div className={`flex flex-1 flex-col overflow-y-auto px-4 pb-3 ${offline ? "gap-3 pt-4" : "gap-4 pt-[18px]"}`}>
        {offline ? (
          <div className="flex flex-col gap-0.5 px-1">
            <span className="text-xs text-[#CFCFCB]">Carimbado com hora e local{position ? "" : " (sem localização)"}</span>
            <span className="font-[family-name:var(--font-anybody)] text-[19px] font-bold">{time} · {siteName}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 px-1">
            <span className="text-[15px] font-semibold">{time} · {siteName}</span>
            <span className="text-[13px] text-[#CFCFCB]">Registro {count + 1} de hoje · hora e local carimbados{position ? "" : " (sem localização)"}</span>
          </div>
        )}
        {phase === "recording" && (
          <div className="flex flex-col items-center gap-3">
            <Waveform height={offline ? 76 : 64} />
            <button type="button" onClick={stop} className="min-h-11 rounded-full bg-[#CCA6ED] px-5 text-sm font-semibold text-[#2D2D2B]">Parar gravação</button>
          </div>
        )}
        {phase === "idle" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#3A3A37] px-4 py-8">
            <button type="button" onClick={() => void start()} className="flex size-24 items-center justify-center rounded-full bg-[#1563FF] text-sm font-semibold">Gravar</button>
          </div>
        )}
        {phase === "recorded" && audio && (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#3A3A37] px-4 py-6">
            <span className="text-[15px] font-semibold">Áudio · {clock(seconds)}</span>
            <audio controls src={URL.createObjectURL(audio.blob)} className="w-full" />
            <button type="button" onClick={() => { setAudio(null); setPhase("idle"); setSeconds(0); }} className="text-[13px] text-[#CCA6ED]">Gravar de novo</button>
          </div>
        )}
        {offline && (
          <>
            <div className="flex flex-col gap-2.5 rounded-[18px] bg-[#3A3A37] px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 flex-none items-center justify-center rounded-full bg-[#52524E]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 17.5h2" /></svg>
                </span>
                <span className="text-[15px] font-semibold">Salvando só no celular</span>
              </div>
              <p className="m-0 text-sm leading-[1.5] text-[#E8E8E4]">Sem sinal, o Argos guarda o áudio e as fotos. Quando a internet voltar, ele envia, preenche o RDO e faz as perguntas do que faltou.</p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-[#6E6E69] px-4 py-3.5">
              <span className="text-xs text-[#CFCFCB]">Transcrição, perguntas da IA e pendências de ontem</span>
              <span className="text-sm text-[#E8E8E4]">Aparecem quando o sinal voltar.</span>
            </div>
          </>
        )}
        <div className="flex flex-col gap-2">
          <div className={`flex justify-between px-1 text-[#CFCFCB] ${offline ? "text-xs" : "text-[13px]"}`}><span>Fotos deste registro</span><span>{photos.length} de {maxPhotos} neste registro</span></div>
          <div className="flex gap-2 overflow-x-auto">
            {photos.map((p) => (
              <span key={p.id} className="relative size-[76px] flex-none overflow-hidden rounded-xl bg-[#52524E]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="Foto do registro" className="size-full object-cover" />
                <span className={`absolute bottom-1.5 left-1.5 text-white ${offline ? "text-[10px]" : "text-xs"}`}>{offline ? "câmera " : ""}{label(p.capturedAt)}</span>
              </span>
            ))}
            {photos.length < maxPhotos && (
              <label className={`flex size-[76px] flex-none cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed text-[#CFCFCB] ${offline ? "border-[#6E6E69] text-[11px]" : "border-[#8A8A85] text-xs"}`}>
                <CameraIcon color="#CFCFCB" />
                Foto
                {photoInput}
              </label>
            )}
          </div>
        </div>
        {error && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{error}</div>}
      </div>
      <div className="flex items-center gap-2.5 px-4 pb-6 pt-3">
        <label aria-label="Tirar foto" className="flex size-[52px] flex-none cursor-pointer items-center justify-center rounded-2xl bg-[#3A3A37]">
          <CameraIcon />
          {photoInput}
        </label>
        {offline ? (
          <button type="button" disabled={blocked && phase !== "recording"} onClick={stopAndSave} className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1563FF] text-[15px] font-semibold disabled:bg-[#3A3A37] disabled:text-[#8A8A85]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            {saving ? "Salvando…" : "Parar e salvar"}
          </button>
        ) : (
          <>
            <button type="button" disabled={!audio || saving || phase === "recording"} onClick={() => void save()} className="flex h-[52px] flex-1 items-center justify-center rounded-2xl bg-[#3A3A37] text-[15px] font-semibold disabled:text-[#8A8A85]">
              {saving ? "Salvando…" : "Salvar registro"}
            </button>
            <button type="button" disabled={!audio || saving || phase === "recording"} onClick={() => void save(true)} className="flex h-[52px] flex-1 items-center justify-center rounded-2xl bg-[#1563FF] text-[15px] font-semibold disabled:bg-[#3A3A37] disabled:text-[#8A8A85]">
              Fechar o dia
            </button>
          </>
        )}
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
