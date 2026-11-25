"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Schemas } from "@argos/contract";
import { api, timezoneParams } from "@/lib/api";
import { documentTypeLabel, errorMessage } from "@/lib/format";
import { getPosition, type Position } from "@/lib/geo";
import { useOnline } from "@/lib/online";
import { ApiError, unwrap } from "@/lib/hooks";
import { Back, Page, Primary, Title, field } from "@/components/ui";

const tz = timezoneParams();
const L = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id} className="text-[13px] text-[#5B5F6B]">{label}</label>{children}</div>
);
const G = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3"><h2 className="m-0 text-[15px] font-semibold">{title}</h2>{children}</section>
);
const dashed = "flex min-h-12 items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-[#9AA3B8] text-[15px] font-semibold text-[#0B3699]";

export function SiteForm() {
  const router = useRouter();
  const online = useOnline();
  const id = useSearchParams().get("id");
  const [f, setF] = useState({
    name: "", type: "private" as Schemas["SiteType"], address: "", clientName: "", clientTaxId: "", contractorName: "", contractorTaxId: "",
    techName: "", artNumber: "", number: "", commitment: "", inspector: "", orderDate: "", durationDays: "",
  });
  const [location, setLocation] = useState<Position | null>(null);
  const [amendments, setAmendments] = useState<{ description: string; addedDays: string; signedOn: string }[]>([]);
  const [sheet, setSheet] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<{ id?: string; name: string; identifier: string }[]>([]);
  const [removedEquipment, setRemovedEquipment] = useState<string[]>([]);
  const [docs, setDocs] = useState<{ id?: string; file?: File; name: string; type: Schemas["DocumentType"]; changed?: boolean }[]>([]);
  const [removedDocs, setRemovedDocs] = useState<string[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const isPublic = f.type !== "private";

  useEffect(() => {
    if (!id) return;
    void unwrap(api.GET("/v1/sites/{siteId}", { params: { path: { siteId: id }, ...tz } })).then((s) => {
      const c = s.publicContract;
      setF({
        name: s.name, type: s.type, address: s.address, clientName: s.client.name, clientTaxId: s.client.taxId,
        contractorName: s.contractor.name, contractorTaxId: s.contractor.taxId, techName: s.technicalManager.name, artNumber: s.technicalManager.artNumber,
        number: c?.number ?? "", commitment: c?.commitmentOrAgreement ?? "", inspector: c?.inspectorName ?? "", orderDate: c?.serviceOrderDate ?? "", durationDays: c ? String(c.durationDays) : "",
      });
      setAmendments(c?.amendments.map((a) => ({ description: a.description, addedDays: String(a.addedDays), signedOn: a.signedOn })) ?? []);
      setSheetName(s.servicesFileName);
      setEquipment(s.equipment.map((e) => ({ id: e.id, name: e.name, identifier: e.identifier ?? "" })));
      setDocs(s.documents.map((d) => ({ id: d.id, name: d.fileName, type: d.type })));
    });
  }, [id]);

  async function save() {
    setError(null);
    if (!id && !sheet) return setError(new ApiError("SPREADSHEET_UNREADABLE"));
    setSaving(true);
    try {
      const body = {
        name: f.name, type: f.type, address: f.address, ...(location ? { location } : {}),
        client: { name: f.clientName, taxId: f.clientTaxId }, contractor: { name: f.contractorName, taxId: f.contractorTaxId },
        technicalManager: { name: f.techName, artNumber: f.artNumber },
        ...(isPublic ? { publicContract: {
          number: f.number, commitmentOrAgreement: f.commitment, inspectorName: f.inspector, serviceOrderDate: f.orderDate, durationDays: Number(f.durationDays),
          amendments: amendments.map((a) => ({ description: a.description, addedDays: Number(a.addedDays), signedOn: a.signedOn })),
        } } : {}),
      };
      const site = id
        ? await unwrap(api.PATCH("/v1/sites/{siteId}", { params: { path: { siteId: id }, ...tz }, body }))
        : await unwrap(api.POST("/v1/sites", { params: tz, body }));
      const path = { siteId: site.id };
      if (sheet) {
        const form = new FormData();
        form.append("file", sheet);
        await unwrap(api.PUT("/v1/sites/{siteId}/services", { params: { path, ...tz }, body: {} as never, bodySerializer: () => form }));
      }
      for (const e of removedEquipment) await unwrap(api.DELETE("/v1/sites/{siteId}/equipment/{equipmentId}", { params: { path: { ...path, equipmentId: e }, ...tz } }));
      for (const e of equipment.filter((x) => !x.id && x.name)) await unwrap(api.POST("/v1/sites/{siteId}/equipment", { params: { path, ...tz }, body: { name: e.name, identifier: e.identifier || null } }));
      for (const d of removedDocs) await unwrap(api.DELETE("/v1/sites/{siteId}/documents/{documentId}", { params: { path: { ...path, documentId: d }, ...tz } }));
      for (const d of docs) {
        if (d.file) {
          const form = new FormData();
          form.append("file", d.file);
          form.append("type", d.type);
          await unwrap(api.POST("/v1/sites/{siteId}/documents", { params: { path, ...tz }, body: {} as never, bodySerializer: () => form }));
        } else if (d.id && d.changed) await unwrap(api.PATCH("/v1/sites/{siteId}/documents/{documentId}", { params: { path: { ...path, documentId: d.id }, ...tz }, body: { type: d.type } }));
      }
      router.push(`/obra?id=${site.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNAVAILABLE"));
      setSaving(false);
    }
  }

  return (
    <Page>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5"><Back href={id ? `/obra?id=${id}` : "/"} /><Title>{id ? "Editar obra" : "Cadastrar obra"}</Title></div>
      <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-1">
        <G title="Obra">
          <L id="nome" label="Nome da obra"><input id="nome" className={field} value={f.name} onChange={(e) => set("name", e.target.value)} /></L>
          <fieldset className="flex gap-1 rounded-[14px] border-[1.5px] border-[#CDD1DD] bg-white p-1">
            <legend className="sr-only">Tipo da obra</legend>
            {([["private", "Privada"], ["public", "Pública"], ["financed", "Financiada"]] as const).map(([v, l]) => (
              <label key={v} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[10px] text-[15px] ${f.type === v ? "bg-[#2D2D2B] font-semibold text-white" : ""}`}>
                <input type="radio" name="tipo" className="sr-only" checked={f.type === v} onChange={() => setF((p) => ({ ...p, type: v }))} />{l}
              </label>
            ))}
          </fieldset>
        </G>
        <G title="Local do canteiro">
          <div className="flex flex-col gap-2.5 rounded-[14px] bg-white p-3">
            <L id="end" label="Endereço"><input id="end" className={field} value={f.address} onChange={(e) => set("address", e.target.value)} /></L>
            <span className="text-[13px] text-[#5B5F6B]">O app reconhece a obra quando você está a até 150 m daqui.</span>
            <button type="button" onClick={() => void getPosition(true).then(setLocation)} className="min-h-11 rounded-[10px] border-[1.5px] border-[#2D2D2B] text-[15px] font-semibold">
              {location ? "Localização atual usada ✓" : "Usar minha localização atual"}
            </button>
          </div>
        </G>
        <G title="Partes do contrato">
          <L id="cn" label="Cliente ou contratante"><input id="cn" className={field} value={f.clientName} onChange={(e) => set("clientName", e.target.value)} /></L>
          <L id="ct" label="CNPJ do cliente ou contratante"><input id="ct" inputMode="numeric" className={field} value={f.clientTaxId} onChange={(e) => set("clientTaxId", e.target.value)} /></L>
          <L id="xn" label="Contratada"><input id="xn" className={field} value={f.contractorName} onChange={(e) => set("contractorName", e.target.value)} /></L>
          <L id="xt" label="CNPJ da contratada"><input id="xt" inputMode="numeric" className={field} value={f.contractorTaxId} onChange={(e) => set("contractorTaxId", e.target.value)} /></L>
        </G>
        {isPublic && (
          <G title="Contrato público">
            <L id="nc" label="Número do contrato"><input id="nc" className={field} value={f.number} onChange={(e) => set("number", e.target.value)} /></L>
            <L id="em" label="Empenho ou convênio"><input id="em" className={field} value={f.commitment} onChange={(e) => set("commitment", e.target.value)} /></L>
            <L id="fi" label="Fiscal do contrato"><input id="fi" className={field} value={f.inspector} onChange={(e) => set("inspector", e.target.value)} /></L>
            <div className="grid grid-cols-2 gap-3">
              <L id="os" label="Data da ordem de serviço"><input id="os" type="date" className={field} value={f.orderDate} onChange={(e) => set("orderDate", e.target.value)} /></L>
              <L id="pz" label="Prazo (dias)"><input id="pz" type="number" className={field} value={f.durationDays} onChange={(e) => set("durationDays", e.target.value)} /></L>
            </div>
            {amendments.map((a, i) => (
              <div key={i} className="grid gap-2 rounded-[14px] bg-white p-3">
                <input aria-label="Descrição do aditivo" placeholder="Descrição" className={field} value={a.description} onChange={(e) => setAmendments((l) => l.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                <div className="grid grid-cols-2 gap-2">
                  <input aria-label="Dias acrescentados" type="number" placeholder="Dias" className={field} value={a.addedDays} onChange={(e) => setAmendments((l) => l.map((x, j) => (j === i ? { ...x, addedDays: e.target.value } : x)))} />
                  <input aria-label="Data da assinatura" type="date" className={field} value={a.signedOn} onChange={(e) => setAmendments((l) => l.map((x, j) => (j === i ? { ...x, signedOn: e.target.value } : x)))} />
                </div>
              </div>
            ))}
            <button type="button" className={dashed} onClick={() => setAmendments((l) => [...l, { description: "", addedDays: "", signedOn: "" }])}>Adicionar aditivo</button>
          </G>
        )}
        <G title="Responsável técnico">
          <L id="rn" label="Nome"><input id="rn" className={field} value={f.techName} onChange={(e) => set("techName", e.target.value)} /></L>
          <L id="art" label="Número da ART"><input id="art" className={field} value={f.artNumber} onChange={(e) => set("artNumber", e.target.value)} /></L>
        </G>
        <G title="Serviços da obra">
          <span className="text-[13px] text-[#5B5F6B]">Obrigatório. Planilha .xlsx ou .csv com código e descrição de cada serviço.</span>
          {(sheet?.name ?? sheetName) && <div className="rounded-[14px] bg-white p-3 text-[15px]">{sheet?.name ?? sheetName}</div>}
          <label className={`${dashed} cursor-pointer`}>{sheet || sheetName ? "Trocar planilha" : "Enviar planilha"}
            <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => setSheet(e.target.files?.[0] ?? null)} />
          </label>
        </G>
        <G title="Equipamentos da obra">
          <span className="text-[13px] text-[#5B5F6B]">{isPublic ? "Obrigatório em obra pública ou financiada." : "Opcional em obra privada."}</span>
          {equipment.map((e, i) => (
            <div key={e.id ?? i} className="flex items-center gap-2 rounded-[14px] bg-white p-3">
              {e.id ? <span className="flex-1 text-[15px]">{e.name}{e.identifier && ` · ${e.identifier}`}</span> : (
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <input aria-label="Nome do equipamento" placeholder="Nome" className={field} value={e.name} onChange={(ev) => setEquipment((l) => l.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))} />
                  <input aria-label="Identificação" placeholder="Placa ou prefixo" className={field} value={e.identifier} onChange={(ev) => setEquipment((l) => l.map((x, j) => (j === i ? { ...x, identifier: ev.target.value } : x)))} />
                </div>
              )}
              <button type="button" aria-label="Remover equipamento" className="size-11 text-[#5B5F6B]" onClick={() => { if (e.id) setRemovedEquipment((r) => [...r, e.id!]); setEquipment((l) => l.filter((_, j) => j !== i)); }}>✕</button>
            </div>
          ))}
          <button type="button" className={dashed} onClick={() => setEquipment((l) => [...l, { name: "", identifier: "" }])}>Adicionar equipamento</button>
        </G>
        <G title="Documentos da obra">
          <span className="text-[13px] text-[#5B5F6B]">Opcional. Anexe e diga o que é cada documento.</span>
          {docs.map((d, i) => (
            <div key={d.id ?? i} className="flex flex-col gap-2 rounded-[14px] bg-white p-3">
              <div className="flex items-center"><span className="flex-1 text-[15px]">{d.name}</span>
                <button type="button" aria-label="Remover documento" className="size-11 text-[#5B5F6B]" onClick={() => { if (d.id) setRemovedDocs((r) => [...r, d.id!]); setDocs((l) => l.filter((_, j) => j !== i)); }}>✕</button></div>
              <select aria-label="Tipo do documento" className={field} value={d.type} onChange={(e) => setDocs((l) => l.map((x, j) => (j === i ? { ...x, type: e.target.value as Schemas["DocumentType"], changed: true } : x)))}>
                {Object.entries(documentTypeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
          <label className={`${dashed} cursor-pointer`}>Anexar documento
            <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) setDocs((l) => [...l, { file, name: file.name, type: "architectural" }]); e.target.value = ""; }} />
          </label>
        </G>
      </div>
      <div className="flex flex-col gap-2 px-4 pb-6 pt-3">
        {error && (
          <div role="alert" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">{errorMessage(error.code)}{error.errors.length > 0 && ` (${error.errors.map((e) => e.field).join(", ")})`}</div>
        )}
        {!online && <div role="status" className="rounded-xl bg-[#FFE9C7] p-3 text-sm text-[#6B3A00]">Sem internet: a obra não é salva sem conexão.</div>}
        <Primary disabled={saving || !online} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar obra"}</Primary>
      </div>
    </Page>
  );
}
