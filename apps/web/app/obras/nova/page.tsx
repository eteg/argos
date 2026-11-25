"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, api, currentLocation, type Site, type SiteType } from "@/lib/api";

const TYPES: [SiteType, string][] = [
  ["private", "Privada"],
  ["public", "Pública"],
  ["financed", "Financiada"],
];

// 2.2 e 2.2b Cadastro de obra. Em obra pública ou financiada, o contrato é obrigatório (RG02).
export default function NewSite() {
  const router = useRouter();
  const [type, setType] = useState<SiteType>("private");
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracyMeters: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function useMyLocation() {
    setLocation(await currentLocation());
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim() || null;
    const isPublic = type !== "private";
    const body = {
      name: v("name"),
      type,
      address: v("address"),
      location,
      client: v("clientName") ? { name: v("clientName"), taxId: v("clientTaxId") } : null,
      contractor: v("contractorName") ? { name: v("contractorName"), taxId: v("contractorTaxId") } : null,
      technicalManager: v("tmName") ? { name: v("tmName"), artNumber: v("tmArt") } : null,
      publicContract: isPublic
        ? {
            number: v("pcNumber"),
            commitmentOrAgreement: v("pcCommitment"),
            inspectorName: v("pcInspector"),
            serviceOrderDate: v("pcServiceOrderDate"),
            durationDays: Number(v("pcDuration")),
          }
        : null,
      equipment: (v("equipment") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name })),
    };
    setSaving(true);
    setErrors({});
    try {
      const site = await api<Site>("/sites", { method: "POST", body: JSON.stringify(body) });
      router.push(`/obras/${site.id}`);
    } catch (err) {
      const list = err instanceof ApiError ? (err.problem.errors as { field: string }[] | undefined) : undefined;
      setErrors(list ? Object.fromEntries(list.map((x) => [x.field, "Preencha este campo"])) : { form: "Não deu pra salvar agora." });
      setSaving(false);
    }
  }

  const err = (field: string) => errors[field] && <div className="error">{errors[field]}</div>;
  const hasPrefix = (prefix: string) => Object.keys(errors).some((k) => k.startsWith(prefix));

  return (
    <main>
      <h1>Nova obra</h1>
      <form onSubmit={submit}>
        <label>Tipo</label>
        <div className="segmented">
          {TYPES.map(([t, label]) => (
            <button key={t} type="button" className="btn" aria-pressed={type === t} onClick={() => setType(t)}>
              {label}
            </button>
          ))}
        </div>

        <label>Nome da obra *</label>
        <input name="name" placeholder="Residencial Vila Verde · Bloco B" />
        {err("name")}
        <label>Endereço</label>
        <input name="address" placeholder="Rua das Acácias, 410 · Contagem, MG" />
        <button type="button" className="btn block" style={{ marginTop: 8 }} onClick={useMyLocation}>
          {location ? `Localização salva (±${location.accuracyMeters} m)` : "Usar minha localização atual"}
        </button>

        <h2>Partes</h2>
        <label>Contratante</label>
        <input name="clientName" placeholder="Nome" />
        <input name="clientTaxId" placeholder="CNPJ" style={{ marginTop: 6 }} />
        <label>Contratada</label>
        <input name="contractorName" placeholder="Nome" />
        <input name="contractorTaxId" placeholder="CNPJ" style={{ marginTop: 6 }} />
        <label>Responsável técnico</label>
        <input name="tmName" placeholder="Eng. Rafael Lima" />
        <input name="tmArt" placeholder="Nº da ART" style={{ marginTop: 6 }} />

        {type !== "private" && (
          <>
            <h2>Contrato público</h2>
            {hasPrefix("publicContract") && <div className="error">Preencha o contrato: número, ordem de serviço e prazo.</div>}
            <label>Nº do contrato *</label>
            <input name="pcNumber" placeholder="045/2026" />
            <label>Empenho ou convênio</label>
            <input name="pcCommitment" placeholder="2026NE000312" />
            <label>Fiscal do contrato</label>
            <input name="pcInspector" />
            <label>Data da ordem de serviço *</label>
            <input name="pcServiceOrderDate" type="date" />
            <label>Prazo em dias *</label>
            <input name="pcDuration" type="number" min={1} placeholder="180" />
          </>
        )}

        <h2>Equipamentos</h2>
        <label>Um por linha</label>
        <textarea name="equipment" rows={3} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)" }} />

        {errors.form && <p className="error">{errors.form}</p>}
        <div className="fixed-bottom">
          <div>
            <button className="btn primary block" disabled={saving}>
              {saving ? "Salvando…" : "Salvar obra"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
