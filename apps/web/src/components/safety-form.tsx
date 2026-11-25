"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { ApiError, unwrap, useLoad } from "@/lib/hooks";
import { Primary, Status, field } from "@/components/ui";

type Occurrence = Schemas["Report"]["occurrences"][number];
type Answer = "" | "yes" | "no";
const tz = timezoneParams();
const toBool = (v: Answer) => (v === "yes" ? true : v === "no" ? false : null);
const fromBool = (v: boolean | null | undefined): Answer => (v === true ? "yes" : v === false ? "no" : "");

export function SafetyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const occId = params.get("occ");
  const [state, retry] = useLoad(() => unwrap(api.GET("/v1/reports/{reportId}", { params: { path: { reportId: id }, ...tz } })), [id]);
  const [edit, setEdit] = useState<{ type?: "accident" | "incident"; description?: string; startTime?: string; dds?: Answer; ppe?: Answer }>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  if (state.status !== "ok") return <main className="mx-auto min-h-dvh max-w-[430px] bg-[#8E9099]"><Status state={state} retry={retry} /></main>;
  const report = state.data;
  const target: Occurrence | undefined =
    report.occurrences.find((o) => o.id === occId) ?? report.occurrences.find((o) => o.type === "accident" && o.safety === null) ?? report.occurrences.find((o) => o.type === "accident");
  const back = `/rdo?id=${id}`;
  if (!target) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-end bg-[#8E9099]">
        <div className="rounded-t-[28px] bg-white p-6"><p className="m-0 text-[15px]">Nenhuma ocorrência de acidente neste RDO.</p><Link href={back} className="mt-4 block font-semibold text-[#1563FF]">Voltar ao RDO</Link></div>
      </main>
    );
  }
  const type = edit.type ?? target.safety?.type ?? "accident";
  const description = edit.description ?? target.description;
  const startTime = edit.startTime ?? target.startTime ?? "";
  const dds = edit.dds ?? fromBool(target.safety?.dds);
  const ppe = edit.ppe ?? fromBool(target.safety?.ppeInUse);
  const ready = description.trim() !== "" && startTime !== "" && dds !== "" && ppe !== "";
  const miss = (answer: Answer) => (answer === "" ? "border-[#A673D6] bg-[#F7F0FD]" : "");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const occurrences = report.occurrences.map((o) =>
        o.id === target!.id ? { ...o, description, startTime, safety: { type, dds: toBool(dds), ppeInUse: toBool(ppe) } } : o,
      );
      await unwrap(api.PATCH("/v1/reports/{reportId}", { params: { path: { reportId: id }, ...tz }, body: { occurrences } }));
      router.push(back);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNAVAILABLE"));
      setSaving(false);
    }
  }

  const yesNo = (label: string, value: Answer, set: (v: Answer) => void, options: [string, string]) => (
    <div className="flex min-w-0 flex-col gap-1"><label className="text-[13px] text-[#5B5F6B]">{label}
      <select className={`${field} mt-1 ${miss(value)}`} value={value} onChange={(e) => set(e.target.value as Answer)}>
        <option value="">Falta responder</option><option value="yes">{options[0]}</option><option value="no">{options[1]}</option></select></label></div>
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#8E9099] font-[family-name:var(--font-inter)] text-[#2D2D2B]">
      <Link href={back} aria-label="Voltar ao RDO" className="h-[72px] flex-none" />
      <div role="dialog" aria-labelledby="seg-titulo" className="flex flex-1 flex-col gap-4 rounded-t-[28px] bg-white px-[18px] pb-6 pt-2.5">
        <span aria-hidden="true" className="h-[5px] w-11 self-center rounded-[3px] bg-[#CDD1DD]" />
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-[#EFE3FA]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B2E86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M12 8v4.5M12 15.5v.1" /></svg></span>
            <span className="text-[13px] font-semibold text-[#5B2E86]">Antes de aprovar</span></div>
          <h1 id="seg-titulo" className="m-0 font-[family-name:var(--font-anybody)] text-2xl font-bold leading-[1.15] tracking-[-0.02em]">Registro de segurança</h1>
          <p className="m-0 text-[15px] leading-[1.45]">Há indício de acidente neste dia. Com acidente, o registro de segurança é obrigatório para aprovar o RDO.</p>
        </div>
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1.5 text-[13px] text-[#5B5F6B]">Tipo</legend>
          <div className="flex gap-1 rounded-[14px] border-[1.5px] border-[#CDD1DD] bg-white p-1">
            {([["accident", "Acidente"], ["incident", "Incidente"]] as const).map(([v, l]) => (
              <label key={v} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[10px] text-[15px] ${type === v ? "bg-[#2D2D2B] font-semibold text-white" : ""}`}>
                <input type="radio" name="tipo" className="sr-only" checked={type === v} onChange={() => setEdit((p) => ({ ...p, type: v }))} />{l}</label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-[13px] text-[#5B5F6B]">O que aconteceu
          <textarea rows={3} className="w-full resize-none rounded-[10px] border-[1.5px] border-[#CDD1DD] px-3 py-2.5 text-[15px] leading-[1.45] text-[#2D2D2B]" value={description} onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))} /></label>
        <label className="flex flex-col gap-1 text-[13px] text-[#5B5F6B]">Horário
          <input type="time" className={`${field} ${startTime === "" ? "border-[#A673D6] bg-[#F7F0FD]" : ""}`} value={startTime} onChange={(e) => setEdit((p) => ({ ...p, startTime: e.target.value }))} /></label>
        <div className="grid grid-cols-2 gap-3">
          {yesNo("DDS do dia", dds, (v) => setEdit((p) => ({ ...p, dds: v })), ["Feito", "Não feito"])}
          {yesNo("EPI em uso", ppe, (v) => setEdit((p) => ({ ...p, ppe: v })), ["Sim", "Não"])}
        </div>
        <span className="text-[13px] leading-[1.45] text-[#4A2470]">Teve DDS hoje? O trabalhador estava usando o EPI?</span>
        {error && <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{errorMessage(error.code)}</div>}
        <div className="mt-auto flex gap-2.5">
          <div className="flex-[1.3]"><Primary disabled={!ready || saving} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar segurança"}</Primary></div>
          <Link href={back} className="flex min-h-[52px] flex-1 items-center justify-center rounded-[14px] border-[1.5px] border-[#2D2D2B] text-[15px] font-semibold">Voltar ao RDO</Link>
        </div>
      </div>
    </main>
  );
}
