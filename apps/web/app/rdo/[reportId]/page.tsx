"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ApiError, api, mediaUrl, type Question, type Report } from "@/lib/api";
import {
  activityStatusLabel,
  conditionLabel,
  date,
  equipmentStatusLabel,
  occurrenceTypeLabel,
  openItemKindLabel,
  outcomeLabel,
  siteTypeLabel,
  time,
  weatherLabel,
} from "@/lib/labels";

const EMPTY = <span className="error">falta</span>;
const show = (v: string | number | null | undefined, label?: Record<string, string>) =>
  v === null || v === undefined || v === "" ? EMPTY : label ? (label[String(v)] ?? v) : v;

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h2>{title}</h2>
      <div className="card">{children}</div>
    </>
  );
}

// 3.3 e 3.3b Revisão do RDO, com as perguntas do agente (RG05), e 3.4 RDO aprovado.
export default function ReportReview() {
  const { reportId } = useParams<{ reportId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState(false);

  const load = useCallback(() => {
    api<Report>(`/reports/${reportId}`)
      .then(setReport)
      .catch(() => setError("RDO não encontrado."));
  }, [reportId]);

  useEffect(load, [load]);

  useEffect(() => {
    if (report?.status !== "generating") return;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [report, load]);

  async function approve() {
    setApproving(true);
    setError("");
    try {
      setReport(await api<Report>(`/reports/${reportId}/approve`, { method: "POST" }));
    } catch (e) {
      setError(e instanceof ApiError && e.code === "REPORT_INCOMPLETE" ? "Ainda faltam campos obrigatórios." : "Não deu pra aprovar agora.");
    }
    setApproving(false);
  }

  if (!report) return <main>{error ? <p className="error">{error}</p> : <p className="muted">Carregando…</p>}</main>;

  const back = (
    <Link href={`/obras/${report.siteId}`} className="muted">
      ← Obra
    </Link>
  );

  if (report.status === "generating") {
    return (
      <main>
        {back}
        <h1>Montando o RDO…</h1>
        <p className="muted">O Argos está lendo os {report.entriesCount} registro(s) de hoje. Leva uns segundos.</p>
      </main>
    );
  }

  if (report.status === "failed") {
    return (
      <main>
        {back}
        <h1>Não deu pra montar o RDO</h1>
        <p className="muted">Volte pra obra e tente gerar de novo.</p>
      </main>
    );
  }

  const approved = report.status === "approved";
  const photosMissing = report.missingFields.some((f) => f.field === "photos");
  const titleOf = (id: string) => report.openItems.find((i) => i.id === id)?.title ?? "Item anterior";

  async function toggleTrack(id: string) {
    const newOpenItems = report!.newOpenItems!.map((n) => (n.id === id ? { ...n, track: !n.track } : n));
    setReport(await api<Report>(`/reports/${reportId}`, { method: "PATCH", body: JSON.stringify({ newOpenItems }) }));
  }
  const unanswered = report.missingFields.filter((f) => f.field !== "photos" && !f.questionId);

  return (
    <main>
      {back}
      <h1>
        RDO nº {String(report.number).padStart(3, "0")} · {date(report.localDate)}
      </h1>
      <div className="muted">
        {report.site.name} · {siteTypeLabel[report.site.type]} · {approved ? "Aprovado" : "Rascunho"}
      </div>

      {approved && report.approval && (
        <div className="card" style={{ marginTop: 12, borderColor: "var(--accent)" }}>
          ✓ Aprovado por {report.approval.approvedBy} às {time(report.approval.approvedAt)} e salvo na obra.
        </div>
      )}

      {!approved && report.missingFields.length > 0 && (
        <div className="card" style={{ marginTop: 12, borderColor: "var(--danger)" }}>
          <strong>
            Faltam {report.missingFields.length} campo(s) obrigatório(s).
          </strong>
          {photosMissing && <p className="muted">O RDO precisa de pelo menos 3 fotos do dia. Faça um registro com fotos.</p>}
          {unanswered.length > 0 && <p className="muted">Sem pergunta: {unanswered.map((f) => f.field).join(", ")}</p>}
        </div>
      )}

      {!approved && report.questions.map((q) => <QuestionCard key={q.id} question={q} onAnswered={setReport} />)}

      {report.workday && (
        <Block title="Jornada e clima">
          {show(report.workday.startTime)} às {show(report.workday.endTime)} · intervalo de{" "}
          {report.workday.breakMinutes === null ? EMPTY : `${report.workday.breakMinutes} min`}
          {report.weather?.map((w) => (
            <div key={w.shift} style={{ marginTop: 6 }}>
              {w.shift === "morning" ? "Manhã" : "Tarde"}: {show(w.weather, weatherLabel)}, {show(w.condition, conditionLabel)}
            </div>
          ))}
          {report.weatherStoppage && <div style={{ marginTop: 6 }}>Horas paradas por clima: {show(report.weatherStoppage.hours)}</div>}
        </Block>
      )}

      {report.labor && (
        <Block title="Efetivo">
          {report.labor.length === 0 && EMPTY}
          {report.labor.map((l, i) => (
            <div key={i}>
              {l.role} · {show(l.count)} · {l.employment === "third_party" ? `Terceiro (${l.company ?? "empresa?"})` : "Próprio"}
            </div>
          ))}
        </Block>
      )}

      {report.equipment && report.equipment.length > 0 && (
        <Block title="Equipamentos">
          {report.equipment.map((e, i) => (
            <div key={i}>
              {e.name} · {show(e.status, equipmentStatusLabel)}
            </div>
          ))}
        </Block>
      )}

      {report.activities && (
        <Block title="Atividades">
          {report.activities.length === 0 && EMPTY}
          {report.activities.map((a) => (
            <div key={a.id} style={{ marginBottom: 6 }}>
              {a.description} · {show(a.location)} · {show(a.status, activityStatusLabel)}
              {report.site.type !== "private" && (
                <>
                  {" "}
                  · {show(a.quantity)} {a.unit ?? ""}
                </>
              )}
            </div>
          ))}
        </Block>
      )}

      {report.occurrences && report.occurrences.length > 0 && (
        <Block title="Ocorrências">
          {report.occurrences.map((o) => (
            <div key={o.id} style={{ marginBottom: 6 }}>
              <strong>{occurrenceTypeLabel[o.type] ?? o.type}</strong> · {o.description} · {show(o.startTime)}
              {o.endTime ? ` às ${o.endTime}` : ""} · {o.status === "closed" ? "encerrada" : "aberta"}
            </div>
          ))}
        </Block>
      )}

      {((report.openItemReviews?.length ?? 0) > 0 || (report.newOpenItems?.length ?? 0) > 0) && (
        <Block title="Itens em aberto">
          {report.openItemReviews?.map((r) => (
            <div key={r.openItemId} style={{ marginBottom: 8 }}>
              <div>{titleOf(r.openItemId)}</div>
              <div className="muted">
                <span className="tag">{outcomeLabel[r.outcome]}</span> {r.note}
              </div>
            </div>
          ))}
          {report.newOpenItems?.map((n) => (
            <div key={n.id} className="row" style={{ marginBottom: 8, opacity: n.track ? 1 : 0.5 }}>
              <div>
                <div>{n.title}</div>
                <div className="muted">
                  <span className="tag">novo</span> {openItemKindLabel[n.kind]}
                </div>
              </div>
              {!approved && (
                <button className="btn" style={{ padding: "6px 10px" }} onClick={() => toggleTrack(n.id)}>
                  {n.track ? "Não acompanhar" : "Acompanhar"}
                </button>
              )}
            </div>
          ))}
        </Block>
      )}

      {approved && (report.newOpenItems?.some((n) => n.track) || report.openItemReviews?.some((r) => r.outcome !== "close")) && (
        <Block title="Amanhã o Argos vai perguntar por">
          {report.openItemReviews
            ?.filter((r) => r.outcome !== "close")
            .map((r) => <div key={r.openItemId}>• {r.note ?? "Item anterior"}</div>)}
          {report.newOpenItems
            ?.filter((n) => n.track)
            .map((n) => <div key={n.id}>• {n.title}</div>)}
        </Block>
      )}

      <h2>Fotos · {report.photos.length} de 20</h2>
      {report.photos.length > 0 && (
        <div className="photos">
          {report.photos.map((p) => (
            <img key={p.id} src={mediaUrl(p.url)} alt="" />
          ))}
        </div>
      )}

      <h2>Histórico</h2>
      <div className="card muted">
        {report.history.map((h, i) => (
          <div key={i}>
            {time(h.at)} · {h.actor === "agent" ? "Argos" : "Você"}: {h.description}
          </div>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {!approved && (
        <div className="fixed-bottom">
          <div>
            <button className="btn primary block" onClick={approve} disabled={approving || report.missingFields.length > 0}>
              {approving ? "Aprovando…" : "Aprovar RDO"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function QuestionCard({ question, onAnswered }: { question: Question; onAnswered: (r: Report) => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send(optionId?: string) {
    if (!optionId && !text.trim()) return;
    setSending(true);
    setError("");
    try {
      const body = optionId ? { optionId } : { text };
      onAnswered(await api<Report>(`/questions/${question.id}/answer`, { method: "POST", body: JSON.stringify(body) }));
    } catch {
      setError("Não deu pra enviar a resposta.");
      setSending(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div>{question.kind === "open_item" ? "📌" : "💬"} {question.text}</div>
      {question.options.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {question.options.map((o) => (
            <button key={o.id} className="btn" style={{ flex: 1, padding: "8px 10px" }} onClick={() => send(o.id)} disabled={sending}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={question.options.length > 0 ? "Ou conte o que mudou" : "Sua resposta"} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn primary" onClick={() => send()} disabled={sending}>
          {sending ? "…" : "Enviar"}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
