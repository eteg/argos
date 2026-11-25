"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api, mediaUrl, today, type Entry, type OpenItem, type Site, type SiteStatus } from "@/lib/api";
import { HIGHLIGHT_DAYS, age, daysSince, siteStatusLabel, siteTypeLabel, time } from "@/lib/labels";

// 2.3 Pasta da obra, com os registros de hoje e o status (2.10).
export default function SiteFolder() {
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [openItems, setOpenItems] = useState<OpenItem[]>([]);
  const [report, setReport] = useState<{ id: string; status: string; number: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Site>(`/sites/${siteId}`).then(setSite).catch(() => setError("Obra não encontrada."));
    api<{ entries: Entry[]; report: typeof report; openItems: OpenItem[] }>(`/sites/${siteId}/days/${today()}`).then((d) => {
      setEntries(d.entries);
      setOpenItems(d.openItems);
      setReport(d.report);
    });
  }, [siteId]);

  useEffect(load, [load]);

  // Enquanto a IA interpreta algum registro, a tela consulta de novo.
  useEffect(() => {
    if (!entries.some((e) => e.status === "processing")) return;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [entries, load]);

  async function generate() {
    setGenerating(true);
    try {
      const r = await api<{ id: string }>(`/sites/${siteId}/days/${today()}/report`, { method: "POST" });
      router.push(`/rdo/${r.id}`);
    } catch {
      setError("Não deu pra gerar o RDO agora.");
      setGenerating(false);
    }
  }

  async function changeStatus(status: SiteStatus) {
    setError("");
    try {
      setSite({ ...site!, ...(await api<Site>(`/sites/${siteId}/status`, { method: "PUT", body: JSON.stringify({ status }) })) });
    } catch (e) {
      if (e instanceof ApiError && e.code === "SITE_HAS_OPEN_REPORTS") {
        const days = (e.problem.days as string[]).length;
        setError(`Falta finalizar ${days} RDO para concluir a obra.`);
      } else setError("Não deu pra mudar o status agora.");
    }
  }

  if (!site) return <main>{error ? <p className="error">{error}</p> : <p className="muted">Carregando…</p>}</main>;

  return (
    <main>
      <Link href="/" className="muted">
        ← Início
      </Link>
      <h1>{site.name}</h1>
      <div className="muted">
        {[site.address, siteTypeLabel[site.type], siteStatusLabel[site.status]].filter(Boolean).join(" · ")}
      </div>
      {site.publicContract && (
        <div className="card" style={{ marginTop: 12 }}>
          Contrato nº {site.publicContract.number} · {site.publicContract.elapsedDays} dias · faltam{" "}
          {site.publicContract.remainingDays}
        </div>
      )}

      {openItems.length > 0 && (
        <>
          <h2>Ficou dos dias anteriores</h2>
          {openItems.map((i) => {
            const days = daysSince(i.openedOn, today());
            return (
              <div key={i.id} className="card" style={days >= HIGHLIGHT_DAYS ? { borderColor: "var(--danger)" } : undefined}>
                <div>{i.title}</div>
                <div className="muted">
                  {i.mentionedToday ? `citado às ${time(i.mentionedToday.capturedAt)}` : "não citado hoje"} · {age(days)}
                  {i.lastUpdate && ` · ${i.lastUpdate.note}`}
                </div>
              </div>
            );
          })}
        </>
      )}

      <h2>Hoje</h2>
      {entries.length === 0 && <p className="muted">Nenhum registro hoje.</p>}
      {entries.map((e) => (
        <div key={e.id} className="card">
          <div className="row">
            <strong>{time(e.capturedAt)}</strong>
            <span className="muted">
              {e.audio ? `Áudio${e.audio.durationSeconds ? ` · ${Math.floor(e.audio.durationSeconds / 60)}:${String(e.audio.durationSeconds % 60).padStart(2, "0")}` : ""}` : "Sem áudio"}
              {e.photos.length > 0 && ` · ${e.photos.length} foto(s)`}
            </span>
          </div>
          {e.status === "processing" && <p className="muted">O Argos está entendendo o registro…</p>}
          {e.title && <p style={{ margin: "8px 0 4px", fontWeight: 600 }}>{e.title}</p>}
          {e.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {e.tags.map((t, i) => (
                <span key={i} className="tag">
                  {t.label}
                </span>
              ))}
            </div>
          )}
          {e.transcript && (
            <details style={{ marginTop: 6 }}>
              <summary className="muted">O que o Argos ouviu</summary>
              <p className="muted">{e.transcript}</p>
            </details>
          )}
          {e.audio && <audio controls src={mediaUrl(e.audio.url)} style={{ width: "100%", marginTop: 8 }} />}
          {e.photos.length > 0 && (
            <div className="photos" style={{ marginTop: 8 }}>
              {e.photos.map((p) => (
                <img key={p.id} src={mediaUrl(p.url)} alt="" />
              ))}
            </div>
          )}
        </div>
      ))}

      {site.recentReports.length > 0 && (
        <>
          <h2>RDOs aprovados · {site.approvedReportsCount} no total</h2>
          {site.recentReports.map((r) => (
            <Link key={r.id} href={`/rdo/${r.id}`} className="card">
              Nº {String(r.number).padStart(3, "0")} · {r.localDate.split("-").reverse().join("/")} · {r.occurrencesCount} ocorrência(s)
            </Link>
          ))}
        </>
      )}

      {site.equipment.length > 0 && (
        <>
          <h2>Equipamentos</h2>
          <div className="card">{site.equipment.map((eq) => eq.name).join(" · ")}</div>
        </>
      )}

      <h2>Status da obra</h2>
      <select value={site.status} onChange={(e) => changeStatus(e.target.value as SiteStatus)}>
        {Object.entries(siteStatusLabel).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {error && <p className="error">{error}</p>}

      {site.status === "in_progress" && (
        <div className="fixed-bottom">
          <div style={{ display: "flex", gap: 8 }}>
            {report?.status === "approved" ? (
              <Link href={`/rdo/${report.id}`} className="btn block">
                RDO nº {report.number} aprovado
              </Link>
            ) : (
              <>
                <Link href={`/obras/${site.id}/registro`} className="btn primary" style={{ flex: 1 }}>
                  🎙 Registrar
                </Link>
                {entries.length > 0 && (
                  <button className="btn" style={{ flex: 1 }} onClick={generate} disabled={generating}>
                    {generating ? "Gerando…" : report ? "Atualizar RDO" : "Gerar RDO"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
