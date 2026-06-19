"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Stepper from "@/app/components/Stepper";
import StatBand from "@/app/components/StatBand";
import Footer from "@/app/components/Footer";

interface HuntedJobUI {
  externalId: string;
  titulo: string;
  budget: string | null;
  score: number;
  motivo: string;
  elegivel: boolean;
  url?: string | null;
  empresa?: string | null;
  fonte?: string | null;
}

interface PreparedAppUI {
  applicationId: string;
  modoEnvio: string;
  proposta: string;
  valorSugerido: string;
  prazoSugerido: string;
  status: string;
  bidId?: number | null;
  real?: boolean;
}

interface TrackerItemUI {
  id: string;
  titulo: string;
  canal: string;
  status: string;
  modoEnvio: string;
  valorSugerido: string | null;
  prazoSugerido: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_envio: "Aguardando envio",
  enviada: "Enviada",
  shortlist: "Shortlist",
  aceita: "Aceita",
  recusada: "Recusada",
  respondida: "Respondida",
};

export default function VagasPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Conexão com o Freelancer (OAuth)
  const [fcConfigured, setFcConfigured] = useState(false);
  const [fcConnected, setFcConnected] = useState(false);

  // Caça de vagas
  const [huntLoading, setHuntLoading] = useState(false);
  const [huntError, setHuntError] = useState<string | null>(null);
  const [huntMode, setHuntMode] = useState<string | null>(null);
  const [huntedJobs, setHuntedJobs] = useState<HuntedJobUI[]>([]);
  const [huntLog, setHuntLog] = useState<string[]>([]);
  const [huntElapsed, setHuntElapsed] = useState(0);

  // Vagas remotas (Remotive — busca automática)
  const [rmLoading, setRmLoading] = useState(false);
  const [rmError, setRmError] = useState<string | null>(null);
  const [rmJobs, setRmJobs] = useState<HuntedJobUI[]>([]);
  const [rmLog, setRmLog] = useState<string[]>([]);
  const [rmElapsed, setRmElapsed] = useState(0);
  const [rmPrepId, setRmPrepId] = useState<string | null>(null);
  const [rmPrepared, setRmPrepared] = useState<Record<string, PreparedAppUI>>(
    {},
  );

  // Outras plataformas (copiloto) — vaga avulsa colada pelo usuário
  const [mPlataforma, setMPlataforma] = useState("linkedin");
  const [mTitulo, setMTitulo] = useState("");
  const [mDescricao, setMDescricao] = useState("");
  const [mLink, setMLink] = useState("");
  const [mLoading, setMLoading] = useState(false);
  const [mError, setMError] = useState<string | null>(null);
  const [mResult, setMResult] = useState<{
    titulo: string;
    proposta: string;
    valorSugerido: string;
    prazoSugerido: string;
    pontosFortes: string[];
  } | null>(null);

  // Fluxo copiloto
  const [prepLoadingId, setPrepLoadingId] = useState<string | null>(null);
  const [sendLoadingId, setSendLoadingId] = useState<string | null>(null);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [preparedApps, setPreparedApps] = useState<Record<string, PreparedAppUI>>(
    {},
  );
  // Valor (número) e prazo (dias) editáveis por vaga, antes de enviar o lance.
  const [bidInputs, setBidInputs] = useState<
    Record<string, { amount: string; period: string }>
  >({});

  // Tracker
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [funnel, setFunnel] = useState<Record<string, number> | null>(null);
  const [trackerItems, setTrackerItems] = useState<TrackerItemUI[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  // Envio/descarte direto pelo acompanhamento (por applicationId).
  const [trkSendId, setTrkSendId] = useState<string | null>(null);
  const [trkDelId, setTrkDelId] = useState<string | null>(null);
  const [trkInputs, setTrkInputs] = useState<
    Record<string, { amount: string; period: string }>
  >({});

  const loadTracker = useCallback(async () => {
    setTrackerLoading(true);
    try {
      const res = await fetch(`/api/applications/list?userId=${userId}`);
      const data = await res.json();
      if (res.ok) {
        setFunnel(data.funnel);
        setTrackerItems(data.items);
        // Pré-preenche valor/prazo dos itens (a partir da sugestão da IA).
        const inputs: Record<string, { amount: string; period: string }> = {};
        for (const it of data.items as TrackerItemUI[]) {
          inputs[it.id] = {
            amount: String(it.valorSugerido ?? "").replace(/[^\d]/g, ""),
            period: (String(it.prazoSugerido ?? "").match(/\d+/) ?? ["7"])[0],
          };
        }
        setTrkInputs(inputs);
      }
    } finally {
      setTrackerLoading(false);
    }
  }, [userId]);

  async function sendFromTracker(item: TrackerItemUI) {
    const isFreelancer = item.canal === "freelancer";
    const bid = trkInputs[item.id];
    const amount = Number(bid?.amount);
    const period = Number(bid?.period);
    if (isFreelancer && (!amount || amount <= 0)) {
      setSyncMsg("Informe um valor de lance maior que zero.");
      return;
    }
    setTrkSendId(item.id);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/applications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isFreelancer
            ? { applicationId: item.id, amount, period: period > 0 ? period : 7 }
            : { applicationId: item.id },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar.");
      setSyncMsg(
        data.real
          ? `✓ Lance enviado no Freelancer${data.bidId ? ` (#${data.bidId})` : ""}.`
          : "✓ Registrada como enviada.",
      );
      await loadTracker();
    } catch (err) {
      setSyncMsg((err as Error).message);
    } finally {
      setTrkSendId(null);
    }
  }

  async function discardApp(id: string) {
    setTrkDelId(id);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/applications/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao descartar.");
      await loadTracker();
    } catch (err) {
      setSyncMsg((err as Error).message);
    } finally {
      setTrkDelId(null);
    }
  }

  async function syncStatus() {
    setSyncLoading(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/applications/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao sincronizar.");
      await loadTracker();
      setSyncMsg(
        data.synced === 0
          ? "Nenhum lance enviado para checar ainda."
          : data.updated > 0
            ? `${data.updated} candidatura(s) com status novo!`
            : `Sem novidades — ${data.synced} lance(s) ainda pendente(s).`,
      );
    } catch (err) {
      setSyncMsg((err as Error).message);
    } finally {
      setSyncLoading(false);
    }
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`/api/profile?userId=${userId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao carregar.");
        if (!cancel) await loadTracker();
        const st = await fetch(`/api/freelancer/status?userId=${userId}`)
          .then((r) => r.json())
          .catch(() => null);
        if (!cancel && st) {
          setFcConfigured(Boolean(st.configured));
          setFcConnected(Boolean(st.connected));
        }
      } catch (err) {
        if (!cancel) setLoadError((err as Error).message);
      } finally {
        if (!cancel) setLoadingProfile(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [userId, loadTracker]);

  async function runHunt() {
    setHuntLoading(true);
    setHuntError(null);
    setHuntLog([]);
    setHuntElapsed(0);
    setHuntedJobs([]);
    try {
      const res = await fetch("/api/jobs/hunt/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Falha ao iniciar a busca.");
      }
      // Lê o stream SSE evento a evento.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const e = JSON.parse(line.slice(5).trim());
          if (e.type === "status") {
            setHuntLog((prev) => [...prev, e.message as string]);
          } else if (e.type === "tick") {
            setHuntElapsed(e.seconds as number);
          } else if (e.type === "result") {
            setHuntMode(e.mode);
            setHuntedJobs(e.jobs);
          } else if (e.type === "error") {
            setHuntError(e.message as string);
          }
        }
      }
    } catch (err) {
      setHuntError((err as Error).message);
    } finally {
      setHuntLoading(false);
    }
  }

  async function analisarVagaAvulsa(e: React.FormEvent) {
    e.preventDefault();
    setMLoading(true);
    setMError(null);
    setMResult(null);
    try {
      const res = await fetch("/api/jobs/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          plataforma: mPlataforma,
          titulo: mTitulo,
          descricao: mDescricao,
          link: mLink || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setMResult({
        titulo: data.titulo,
        proposta: data.proposta,
        valorSugerido: data.valorSugerido,
        prazoSugerido: data.prazoSugerido,
        pontosFortes: data.pontosFortes ?? [],
      });
      await loadTracker();
    } catch (err) {
      setMError((err as Error).message);
    } finally {
      setMLoading(false);
    }
  }

  async function runRemotiveHunt() {
    setRmLoading(true);
    setRmError(null);
    setRmLog([]);
    setRmElapsed(0);
    setRmJobs([]);
    try {
      const res = await fetch("/api/jobs/remotive/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Falha ao iniciar a busca.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const e = JSON.parse(line.slice(5).trim());
          if (e.type === "status") {
            setRmLog((prev) => [...prev, e.message as string]);
          } else if (e.type === "tick") {
            setRmElapsed(e.seconds as number);
          } else if (e.type === "result") {
            setRmJobs(e.jobs);
          } else if (e.type === "error") {
            setRmError(e.message as string);
          }
        }
      }
    } catch (err) {
      setRmError((err as Error).message);
    } finally {
      setRmLoading(false);
    }
  }

  async function prepareRemotive(externalId: string) {
    setRmPrepId(externalId);
    setRmError(null);
    try {
      const res = await fetch("/api/applications/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, externalId, tipo: "remotive" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setRmPrepared((prev) => ({ ...prev, [externalId]: data }));
      await loadTracker();
    } catch (err) {
      setRmError((err as Error).message);
    } finally {
      setRmPrepId(null);
    }
  }

  async function prepareApp(externalId: string) {
    setPrepLoadingId(externalId);
    setCopilotError(null);
    try {
      const res = await fetch("/api/applications/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, externalId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setPreparedApps((prev) => ({ ...prev, [externalId]: data }));
      // Pré-preenche valor/prazo a partir da sugestão da IA (editável).
      setBidInputs((prev) => ({
        ...prev,
        [externalId]: {
          amount: String(data.valorSugerido ?? "").replace(/[^\d]/g, ""),
          period: ((String(data.prazoSugerido ?? "").match(/\d+/) ?? [
            "7",
          ])[0]),
        },
      }));
      await loadTracker();
    } catch (err) {
      setCopilotError((err as Error).message);
    } finally {
      setPrepLoadingId(null);
    }
  }

  async function sendApp(externalId: string) {
    const app = preparedApps[externalId];
    if (!app) return;
    const bid = bidInputs[externalId];
    const amount = Number(bid?.amount);
    const period = Number(bid?.period);
    if (!amount || amount <= 0) {
      setCopilotError("Informe um valor de lance maior que zero.");
      return;
    }
    setSendLoadingId(externalId);
    setCopilotError(null);
    try {
      const res = await fetch("/api/applications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: app.applicationId,
          amount,
          period: period > 0 ? period : 7,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setPreparedApps((prev) => ({
        ...prev,
        [externalId]: {
          ...prev[externalId],
          status: data.status,
          bidId: data.bidId,
          real: data.real,
        },
      }));
      await loadTracker();
    } catch (err) {
      setCopilotError((err as Error).message);
    } finally {
      setSendLoadingId(null);
    }
  }

  if (loadingProfile) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-slate-500">
        Carregando...
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Stepper current="vagas" />
        <div className="mt-8 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
          {loadError}
        </div>
        <button
          onClick={() => router.push("/onboarding")}
          className="mt-4 rounded-lg bg-[#3398DB] px-6 py-3 font-semibold text-white transition hover:bg-[#2b82c2]"
        >
          ← Voltar ao início
        </button>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 pt-8">
        <Stepper current="vagas" userId={userId} />
      </div>

      {/* Hero corporate (claro, com ilustração — estilo template) */}
      <header className="border-b border-[#EBEBEB] bg-gradient-to-bl from-[#fdece6] via-white to-white">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-8 px-6 py-16 md:grid-cols-[1fr_auto]">
          <div>
            <p className="eyebrow">Candidaturas</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#151D26] sm:text-5xl">
              Vagas e candidaturas
            </h1>
            <p className="mt-4 max-w-xl text-[#517193]">
              A IA busca vagas, pontua a compatibilidade e prepara propostas no
              modelo copiloto.
            </p>
            <button
              onClick={() => router.push(`/portfolio/${userId}`)}
              className="mt-6 border border-[#151D26] px-4 py-2 text-sm font-medium text-[#151D26] transition hover:bg-[#151D26] hover:text-white"
            >
              ← Voltar ao portfólio
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/connected-world.png"
            alt=""
            className="hidden w-[300px] justify-self-end md:block lg:w-[360px]"
          />
        </div>

        {/* Banda de stats — funil de candidaturas */}
        <div className="mx-auto max-w-5xl px-6 pb-12">
          <StatBand
            cols="sm:grid-cols-5"
            items={[
              { value: funnel?.aguardando_envio ?? 0, label: "Aguardando" },
              { value: funnel?.enviada ?? 0, label: "Enviadas" },
              { value: funnel?.shortlist ?? 0, label: "Shortlist" },
              { value: funnel?.aceita ?? 0, label: "Aceitas" },
              { value: funnel?.recusada ?? 0, label: "Recusadas" },
            ]}
          />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 pb-20 pt-8">

      {/* Caça de vagas */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-[#151D26]">Caça de vagas (Freelancer.com)</h2>
        <p className="text-slate-500">
          Vagas com compatibilidade abaixo de 60 são descartadas.
        </p>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
          {fcConnected ? (
            <>
              <span className="text-sm font-medium text-green-700">
                ✓ Conectado ao Freelancer — busca de vagas reais ativa
              </span>
              <a
                href={`/perfil-freelancer/${userId}`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:border-slate-400"
              >
                Otimizar perfil →
              </a>
            </>
          ) : fcConfigured ? (
            <>
              <span className="text-sm text-slate-600">
                Conecte sua conta do Freelancer para buscar vagas reais.
              </span>
              <a
                href={`/api/freelancer/connect?userId=${userId}`}
                className="rounded-lg bg-[#3398DB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2b82c2]"
              >
                Conectar Freelancer
              </a>
            </>
          ) : (
            <span className="text-sm text-amber-600">
              OAuth do Freelancer não configurado (faltam Client ID/Secret no
              .env). Usando modo demonstração.
            </span>
          )}
        </div>

        <button
          onClick={runHunt}
          disabled={huntLoading}
          className="rounded-lg bg-[#3398DB] px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-[#2b82c2] disabled:opacity-50"
        >
          {huntLoading ? "Buscando vagas..." : "Buscar vagas"}
        </button>

        {(huntLoading || huntLog.length > 0) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              {huntLoading ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
                  <span>Claude trabalhando… {huntElapsed}s</span>
                </>
              ) : (
                <span className="text-green-700">✓ Busca concluída</span>
              )}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              {huntLog.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {huntMode === "mock" && (
          <p className="text-sm text-amber-600">
            Modo demonstração (sem token do Freelancer) — usando vagas-mock.
          </p>
        )}
        {huntError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
            {huntError}
          </div>
        )}
        {copilotError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
            {copilotError}
          </div>
        )}

        {huntedJobs.length > 0 && (
          <ul className="space-y-3">
            {huntedJobs.map((job) => {
              const app = preparedApps[job.externalId];
              return (
                <li
                  key={job.externalId}
                  className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{job.titulo}</p>
                      <p className="text-sm text-slate-500">{job.motivo}</p>
                      {job.budget && (
                        <p className="mt-1 text-xs text-slate-400">
                          Orçamento: {job.budget}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-lg font-bold">{job.score}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          job.elegivel
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {job.elegivel ? "elegível" : "descartada"}
                      </span>
                    </div>
                  </div>

                  {job.elegivel && !app && (
                    <button
                      onClick={() => prepareApp(job.externalId)}
                      disabled={prepLoadingId === job.externalId}
                      className="mt-3 rounded-lg bg-[#3398DB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2b82c2] disabled:opacity-50"
                    >
                      {prepLoadingId === job.externalId
                        ? "Preparando..."
                        : "Preparar candidatura"}
                    </button>
                  )}

                  {app && (
                    <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase text-slate-400">
                          Proposta ({app.modoEnvio})
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            app.status === "enviada"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {app.status === "enviada"
                            ? "enviada"
                            : "aguardando envio"}
                        </span>
                      </div>

                      {app.status !== "enviada" && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          ⚠️ <strong>Ainda não enviada.</strong> Confira o valor
                          e o prazo abaixo e clique em{" "}
                          <strong>“Enviar lance no Freelancer”</strong> para
                          candidatar-se de verdade.
                        </div>
                      )}

                      <p className="whitespace-pre-wrap text-sm">
                        {app.proposta}
                      </p>
                      <p className="text-xs text-slate-400">
                        Sugestão da IA — Valor: {app.valorSugerido} · Prazo:{" "}
                        {app.prazoSugerido}
                      </p>

                      {app.status !== "enviada" ? (
                        <>
                          <div className="flex flex-wrap items-end gap-3">
                            <label className="text-xs text-slate-500">
                              Valor do lance
                              <input
                                type="number"
                                min={1}
                                value={bidInputs[job.externalId]?.amount ?? ""}
                                onChange={(e) =>
                                  setBidInputs((prev) => ({
                                    ...prev,
                                    [job.externalId]: {
                                      ...prev[job.externalId],
                                      amount: e.target.value,
                                    },
                                  }))
                                }
                                className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#3398DB]"
                              />
                            </label>
                            <label className="text-xs text-slate-500">
                              Prazo (dias)
                              <input
                                type="number"
                                min={1}
                                value={bidInputs[job.externalId]?.period ?? ""}
                                onChange={(e) =>
                                  setBidInputs((prev) => ({
                                    ...prev,
                                    [job.externalId]: {
                                      ...prev[job.externalId],
                                      period: e.target.value,
                                    },
                                  }))
                                }
                                className="mt-1 block w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#3398DB]"
                              />
                            </label>
                            {job.budget && (
                              <span className="pb-2 text-xs text-slate-400">
                                Orçamento da vaga: {job.budget}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(app.proposta)
                              }
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                            >
                              Copiar proposta
                            </button>
                            <button
                              onClick={() => sendApp(job.externalId)}
                              disabled={sendLoadingId === job.externalId}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                            >
                              {sendLoadingId === job.externalId
                                ? "Enviando lance..."
                                : "Enviar lance no Freelancer"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm font-medium text-green-700">
                          {app.real
                            ? `✓ Lance enviado no Freelancer${app.bidId ? ` (#${app.bidId})` : ""}`
                            : "✓ Registrada como enviada"}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Vagas remotas (busca automática) */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-[#151D26]">
          Vagas remotas (busca automática)
        </h2>
        <p className="text-slate-500">
          Busca automática em quadros de vagas remotas abertas (Remotive,
          RemoteOK, Arbeitnow, WeWorkRemotely). A IA pontua e escreve a
          proposta; você aplica no link da vaga.
        </p>

        <button
          onClick={runRemotiveHunt}
          disabled={rmLoading}
          className="rounded-lg bg-[#3398DB] px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-[#2b82c2] disabled:opacity-50"
        >
          {rmLoading ? "Buscando vagas remotas..." : "Buscar vagas remotas"}
        </button>

        {(rmLoading || rmLog.length > 0) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              {rmLoading ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
                  <span>Claude trabalhando… {rmElapsed}s</span>
                </>
              ) : (
                <span className="text-green-700">✓ Busca concluída</span>
              )}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              {rmLog.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rmError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
            {rmError}
          </div>
        )}

        {rmJobs.length > 0 && (
          <ul className="space-y-3">
            {rmJobs.map((job) => {
              const app = rmPrepared[job.externalId];
              return (
                <li
                  key={job.externalId}
                  className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{job.titulo}</p>
                      <p className="text-xs text-slate-400">
                        {job.empresa}
                        {job.empresa && job.fonte ? " · " : ""}
                        {job.fonte && (
                          <span className="text-slate-500">via {job.fonte}</span>
                        )}
                      </p>
                      <p className="text-sm text-slate-500">{job.motivo}</p>
                      {job.url && (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm underline hover:text-black"
                        >
                          Ver vaga ↗
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-lg font-bold">{job.score}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          job.elegivel
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {job.elegivel ? "elegível" : "descartada"}
                      </span>
                    </div>
                  </div>

                  {job.elegivel && !app && (
                    <button
                      onClick={() => prepareRemotive(job.externalId)}
                      disabled={rmPrepId === job.externalId}
                      className="mt-3 rounded-lg bg-[#3398DB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2b82c2] disabled:opacity-50"
                    >
                      {rmPrepId === job.externalId
                        ? "Escrevendo..."
                        : "Preparar proposta"}
                    </button>
                  )}

                  {app && (
                    <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-4">
                      <p className="whitespace-pre-wrap text-sm">
                        {app.proposta}
                      </p>
                      <p className="text-xs text-slate-500">
                        Valor: {app.valorSugerido} · Prazo: {app.prazoSugerido}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(app.proposta)
                          }
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                        >
                          Copiar proposta
                        </button>
                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white"
                          >
                            Aplicar no site ↗
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        Já está no seu Acompanhamento. Aplique no site e marque
                        como enviada.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Outras plataformas (copiloto) */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-[#151D26]">Outras plataformas (copiloto)</h2>
        <p className="text-slate-500">
          LinkedIn, Workana, Upwork e outros não têm API aberta — então você
          traz a vaga e a IA escreve a proposta. Cole o texto da vaga abaixo;
          depois é só copiar a proposta e aplicar no site.
        </p>

        <form onSubmit={analisarVagaAvulsa} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-600">
              Plataforma
              <select
                value={mPlataforma}
                onChange={(e) => setMPlataforma(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#3398DB]"
              >
                <option value="linkedin">LinkedIn</option>
                <option value="workana">Workana</option>
                <option value="upwork">Upwork</option>
                <option value="fiverr">Fiverr</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Link da vaga (opcional)
              <input
                type="url"
                value={mLink}
                onChange={(e) => setMLink(e.target.value)}
                placeholder="https://..."
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#3398DB]"
              />
            </label>
          </div>
          <input
            type="text"
            value={mTitulo}
            onChange={(e) => setMTitulo(e.target.value)}
            placeholder="Título da vaga"
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#3398DB]"
          />
          <textarea
            value={mDescricao}
            onChange={(e) => setMDescricao(e.target.value)}
            placeholder="Cole aqui a descrição completa da vaga..."
            rows={6}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#3398DB]"
          />
          <button
            type="submit"
            disabled={mLoading}
            className="rounded-lg bg-[#3398DB] px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-[#2b82c2] disabled:opacity-50"
          >
            {mLoading
              ? "IA escrevendo proposta..."
              : "Analisar e escrever proposta"}
          </button>
        </form>

        {mError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
            {mError}
          </div>
        )}

        {mResult && (
          <div className="space-y-3 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-slate-400">
                Proposta — {mResult.titulo}
              </span>
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-700">
                salva no acompanhamento
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{mResult.proposta}</p>
            <p className="text-xs text-slate-500">
              Valor sugerido: {mResult.valorSugerido} · Prazo:{" "}
              {mResult.prazoSugerido}
            </p>
            {mResult.pontosFortes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mResult.pontosFortes.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-700"
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(mResult.proposta)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              Copiar proposta
            </button>
          </div>
        )}
      </section>

      {/* Acompanhamento */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-[#151D26]">Acompanhamento</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={syncStatus}
              disabled={syncLoading}
              className="rounded-lg bg-[#3398DB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2b82c2] disabled:opacity-50"
            >
              {syncLoading ? "Checando..." : "Atualizar status"}
            </button>
            <button
              onClick={loadTracker}
              disabled={trackerLoading}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
            >
              {trackerLoading ? "..." : "Recarregar"}
            </button>
          </div>
        </div>

        {syncMsg && <p className="text-sm text-slate-600">{syncMsg}</p>}
        <p className="text-xs text-slate-400">
          Este painel só acompanha — para <strong>enviar</strong> candidaturas,
          use a seção <strong>Caça de vagas</strong> acima ↑. &quot;Atualizar
          status&quot; consulta o Freelancer e marca cada lance como aceito,
          recusado ou em shortlist (é grátis, não gasta seus bids).
        </p>

        <p className="text-xs text-slate-400">
          Resumo do funil no topo da página ↑
        </p>

        {trackerItems.length > 0 && (
          <ul className="space-y-2">
            {trackerItems.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-slate-200 p-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{item.titulo}</p>
                    <p className="text-xs text-slate-400">
                      {item.canal} · {item.modoEnvio}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      item.status === "aceita"
                        ? "bg-green-100 text-green-700"
                        : item.status === "recusada"
                          ? "bg-red-100 text-red-700"
                          : item.status === "shortlist" ||
                              item.status === "respondida"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>

                {item.status === "aguardando_envio" ? (
                  <div className="mt-3 space-y-2">
                    {item.canal === "freelancer" ? (
                      <>
                        <p className="text-xs text-amber-700">
                          ⚠️ Preparada mas ainda não enviada — envie o lance ou
                          descarte.
                        </p>
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="text-xs text-slate-500">
                            Valor
                            <input
                              type="number"
                              min={1}
                              value={trkInputs[item.id]?.amount ?? ""}
                              onChange={(e) =>
                                setTrkInputs((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    amount: e.target.value,
                                  },
                                }))
                              }
                              className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#3398DB]"
                            />
                          </label>
                          <label className="text-xs text-slate-500">
                            Prazo (dias)
                            <input
                              type="number"
                              min={1}
                              value={trkInputs[item.id]?.period ?? ""}
                              onChange={(e) =>
                                setTrkInputs((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    period: e.target.value,
                                  },
                                }))
                              }
                              className="mt-1 block w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#3398DB]"
                            />
                          </label>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-amber-700">
                        ⚠️ Proposta pronta — aplique no site ({item.canal}) e
                        marque como enviada (ou descarte).
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => sendFromTracker(item)}
                        disabled={trkSendId === item.id}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {trkSendId === item.id
                          ? "Salvando..."
                          : item.canal === "freelancer"
                            ? "Enviar lance"
                            : "Marcar como enviada"}
                      </button>
                      <button
                        onClick={() => discardApp(item.id)}
                        disabled={trkDelId === item.id}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-red-600 hover:border-red-400 disabled:opacity-50"
                      >
                        {trkDelId === item.id ? "..." : "Descartar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => discardApp(item.id)}
                      disabled={trkDelId === item.id}
                      className="text-xs text-slate-400 underline hover:text-red-600 disabled:opacity-50"
                    >
                      {trkDelId === item.id ? "..." : "Remover"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      </main>

      <Footer
        ctaTitle="Pronto para a próxima vaga?"
        ctaLabel="Buscar agora ↑"
        onCta={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      />
    </div>
  );
}
