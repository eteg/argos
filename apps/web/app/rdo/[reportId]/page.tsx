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

const EMPTY = <span className="tag lilac">falta</span>;
const show = (v: string | number | null | undefined, label?: Record<string, string>) =>
  v === null || v === undefined || v === "" ? EMPTY : label ? (label[String(v)] ?? v) : v;

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-title">{title}</div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Header({ siteId, title, subtitle }: { siteId: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
      <Link href={`/obras/${siteId}`} className="icon-btn" aria-label="Voltar pra obra">
        ‹
      </Link>
      <div>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <div className="muted">{subtitle}</div>
      </div>
    </div>
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

  if (report.status === "generating") {
    return (
      <main>
        <Header siteId={report.siteId} title="Montando o RDO…" subtitle={`Lendo os ${report.entriesCount} registro(s) de hoje`} />
        <div className="notice blue">O Argos está juntando os áudios e as fotos do dia. Leva uns segundos.</div>
      </main>
    );
  }

  if (report.status === "failed") {
    return (
      <main>
        <Header siteId={report.siteId} title="Não deu pra montar" subtitle="Volte pra obra e tente gerar de novo" />
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
      <Header
        siteId={report.siteId}
        title={approved ? "RDO aprovado" : "Revise o RDO"}
        subtitle={approved ? `Nº ${String(report.number).padStart(3, "0")} · ${date(report.localDate)}` : `Montado a partir dos ${report.entriesCount} registro(s) do dia`}
      />

      {approved && report.approval && (
        <div className="notice blue">
          ✓ Aprovado por {report.approval.approvedBy} às {time(report.approval.approvedAt)} e salvo na obra.
        </div>
      )}

      {!approved && report.missingFields.length > 0 && (
        <div className="notice">
          <span>ⓘ</span>
          <div>
            Faltam {report.missingFields.length} campo(s) obrigatório(s). Nada é salvo antes da sua aprovação.
            {photosMissing && <div>O RDO precisa de pelo menos 3 fotos do dia: faça um registro com fotos.</div>}
            {unanswered.length > 0 && <div>Sem pergunta: {unanswered.map((f) => f.field).join(", ")}</div>}
          </div>
        </div>
      )}

      {!approved && report.questions.map((q) => <QuestionCard key={q.id} question={q} onAnswered={setReport} />)}

      <Block title="Identificação">
        <div className="grid-2">
          <Field label="RDO">
            Nº {String(report.number).padStart(3, "0")} · {date(report.localDate)}
          </Field>
          <Field label="Obra">{report.site.name}</Field>
          <Field label="Tipo">{siteTypeLabel[report.site.type]}</Field>
          <Field label="Situação">{approved ? "Aprovado" : "Rascunho"}</Field>
        </div>
      </Block>

      {report.workday && (
        <Block title="Jornada e clima">
          <div className="grid-2">
            <Field label="Entrada">{show(report.workday.startTime)}</Field>
            <Field label="Saída">{show(report.workday.endTime)}</Field>
            <Field label="Intervalo">{report.workday.breakMinutes === null ? EMPTY : `${report.workday.breakMinutes} min`}</Field>
            {report.weatherStoppage && <Field label="Horas paradas por clima">{show(report.weatherStoppage.hours)}</Field>}
            {report.weather?.map((w) => (
              <Field key={w.shift} label={w.shift === "morning" ? "Manhã" : "Tarde"}>
                {show(w.weather, weatherLabel)} · {show(w.condition, conditionLabel)}
              </Field>
            ))}
          </div>
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
                <span className={`tag ${r.outcome === "close" ? "" : "lilac"}`}>{outcomeLabel[r.outcome]}</span> {r.note}
              </div>
            </div>
          ))}
          {report.newOpenItems?.map((n) => (
            <div key={n.id} className="row" style={{ marginBottom: 8, opacity: n.track ? 1 : 0.5 }}>
              <div>
                <div>{n.title}</div>
                <div className="muted">
                  <span className="tag lilac">novo</span> {openItemKindLabel[n.kind]}
                </div>
              </div>
              {!approved && (
                <button className="btn small" onClick={() => toggleTrack(n.id)}>
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

      <Block title={`Fotos · ${report.photos.length} de 20`}>
        {report.photos.length === 0 ? (
          EMPTY
        ) : (
          <div className="photos">
            {report.photos.map((p) => (
              <img key={p.id} src={mediaUrl(p.url)} alt="" />
            ))}
          </div>
        )}
      </Block>

      <Block title="Validação">
        <div className="muted">
          {report.history.map((h, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              {time(h.at)} · {h.actor === "agent" ? "Argos" : "Você"}: {h.description}
            </div>
          ))}
        </div>
      </Block>

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
    <div className={`card ${question.kind === "open_item" ? "memory" : ""}`}>
      <div className="label">{question.kind === "open_item" ? "Ficou dos dias anteriores" : "O Argos perguntou"}</div>
      <div style={{ fontWeight: 600 }}>{question.text}</div>
      {question.options.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {question.options.map((o) => (
            <button key={o.id} className="btn small" style={{ flex: 1 }} onClick={() => send(o.id)} disabled={sending}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={question.options.length > 0 ? "Ou conte o que mudou" : "Sua resposta"} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn primary small" onClick={() => send()} disabled={sending}>
          {sending ? "…" : "Enviar"}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
