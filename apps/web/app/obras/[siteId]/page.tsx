"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
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

  async function deleteEntry(entry: Entry) {
    if (!window.confirm(`Apagar o registro das ${time(entry.capturedAt)}, com o áudio e as fotos? Não dá pra desfazer.`)) return;
    setError("");
    try {
      await api(`/entries/${entry.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof ApiError && e.code === "REPORT_ALREADY_APPROVED" ? "O RDO do dia já foi aprovado: o registro não sai mais." : "Não deu pra apagar o registro agora.");
    }
  }

  async function deleteSite() {
    const typed = window.prompt(
      `Apagar a obra apaga também todos os registros, áudios, fotos, RDOs e pendências dela. Não dá pra desfazer.\n\nPra confirmar, escreva o nome da obra:\n${site!.name}`,
    );
    if (typed === null) return;
    if (typed.trim() !== site!.name) return setError("O nome não confere. A obra não foi apagada.");
    try {
      await api(`/sites/${siteId}`, { method: "DELETE" });
      router.replace("/");
    } catch {
      setError("Não deu pra apagar a obra agora.");
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

  const duration = (sec: number | null) => (sec ? ` · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "");

  return (
    <main>
      <header className="hero">
        <div className="row">
          <Link href="/" className="icon-btn" aria-label="Voltar">
            ‹
          </Link>
          <Link href="/obras/todas" className="icon-btn" aria-label="Todas as obras">
            ☰
          </Link>
        </div>
        <h1>{site.name}</h1>
        <div className="muted">
          {[site.address, siteTypeLabel[site.type], siteStatusLabel[site.status]].filter(Boolean).join(" · ")}
        </div>
      </header>

      {site.publicContract && (
        <div className="notice blue">
          Contrato nº {site.publicContract.number} · {site.publicContract.elapsedDays} dias decorridos · faltam{" "}
          {site.publicContract.remainingDays}
        </div>
      )}

      {site.status === "in_progress" && (
        <div className="card accent row">
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>RDO de hoje</div>
            <div className="muted">
              {report?.status === "approved"
                ? `Nº ${String(report.number).padStart(3, "0")} aprovado`
                : entries.length === 0
                  ? "nenhum registro ainda"
                  : `${entries.length} registro(s) · ${report ? "falta revisar e aprovar" : "falta fechar o dia"}`}
            </div>
          </div>
          {report?.status === "approved" ? (
            <Link href={`/rdo/${report.id}`} className="btn soft small">
              Ver
            </Link>
          ) : report ? (
            <Link href={`/rdo/${report.id}`} className="btn primary small">
              Continuar
            </Link>
          ) : entries.length > 0 ? (
            <button className="btn primary small" onClick={generate} disabled={generating}>
              {generating ? "Gerando…" : "Gerar RDO"}
            </button>
          ) : null}
        </div>
      )}
      {report && report.status !== "approved" && entries.length > 0 && (
        <button className="btn block" style={{ marginBottom: 12 }} onClick={generate} disabled={generating}>
          {generating ? "Gerando…" : "Atualizar o RDO com os registros novos"}
        </button>
      )}

      {openItems.length > 0 && (
        <>
          <div className="row">
            <h2>Em aberto nesta obra</h2>
            <Link href="/pendencias" className="link">
              Ver pendências
            </Link>
          </div>
          <div className="list" style={{ border: "1px solid var(--lilac-line)", boxShadow: "none" }}>
            {openItems.map((i) => {
              const days = daysSince(i.openedOn, today());
              return (
                <div key={i.id}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{i.title}</div>
                    <div className="muted">
                      {i.mentionedToday ? `citado às ${time(i.mentionedToday.capturedAt)}` : "não citado hoje"}
                      {i.lastUpdate && ` · ${i.lastUpdate.note}`}
                    </div>
                  </div>
                  <span className={`tag ${days >= HIGHLIGHT_DAYS ? "lilac" : ""}`}>{age(days)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2>Registros de hoje</h2>
      {entries.length === 0 && <p className="muted">Nenhum registro hoje. Toque em Registrar e conte o que aconteceu.</p>}
      {entries.map((e) => (
        <div key={e.id} className="card">
          <div className="row">
            <strong>{time(e.capturedAt)}</strong>
            <span className="muted">
              {e.audio ? `Áudio${duration(e.audio.durationSeconds)}` : "Sem áudio"}
              {e.photos.length > 0 && ` · ${e.photos.length} foto(s)`}
              {report?.status !== "approved" && (
                <button
                  onClick={() => deleteEntry(e)}
                  aria-label={`Apagar o registro das ${time(e.capturedAt)}`}
                  style={{ marginLeft: 10, border: "none", background: "none", color: "var(--danger)", cursor: "pointer", padding: 0, fontSize: ".9rem" }}
                >
                  Apagar
                </button>
              )}
            </span>
          </div>
          {e.status === "processing" && <p className="muted">O Argos está entendendo o registro…</p>}
          {e.status === "failed" && <p className="error">O Argos não conseguiu entender este áudio.</p>}
          {e.title && <p style={{ margin: "8px 0 6px", fontWeight: 700 }}>{e.title}</p>}
          {e.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {e.tags.map((t, i) => (
                <span key={i} className={`tag ${t.kind === "occurrence" || t.kind === "safety" ? "lilac" : ""}`}>
                  {t.label}
                </span>
              ))}
            </div>
          )}
          {e.openItemIds.length > 0 && (
            <div className="muted" style={{ marginTop: 6 }}>
              ↻ Atualiza {e.openItemIds.length} item(ns) em aberto
            </div>
          )}
          {e.transcript && (
            <details style={{ marginTop: 8 }}>
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
          <div className="row">
            <h2>RDOs aprovados</h2>
            <span className="muted">{site.approvedReportsCount} no total</span>
          </div>
          <div className="list">
            {site.recentReports.map((r) => (
              <Link key={r.id} href={`/rdo/${r.id}`}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    Nº {String(r.number).padStart(3, "0")} · {r.localDate.split("-").reverse().join("/").slice(0, 5)}
                  </div>
                  <div className="muted">{r.occurrencesCount === 0 ? "sem ocorrências" : `${r.occurrencesCount} ocorrência(s)`}</div>
                </div>
                <span>›</span>
              </Link>
            ))}
          </div>
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

      <button className="btn block" style={{ marginTop: 24, color: "var(--danger)" }} onClick={deleteSite}>
        Apagar obra
      </button>

      {site.status === "in_progress" && report?.status !== "approved" && (
        <BottomNav current="home" registerHref={`/obras/${site.id}/registro`} />
      )}
    </main>
  );
}
