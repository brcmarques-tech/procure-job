"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EXAMPLE_JOBS } from "@/lib/exampleJobs";
import Stepper from "@/app/components/Stepper";

interface ProposalResult {
  proposta: string;
  valorSugerido: string;
  prazoSugerido: string;
  pontosFortes: string[];
}

interface HuntedJobUI {
  externalId: string;
  titulo: string;
  budget: string | null;
  score: number;
  motivo: string;
  elegivel: boolean;
}

interface PreparedAppUI {
  applicationId: string;
  modoEnvio: string;
  proposta: string;
  valorSugerido: string;
  prazoSugerido: string;
  status: string;
}

interface TrackerItemUI {
  id: string;
  titulo: string;
  canal: string;
  status: string;
  modoEnvio: string;
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_envio: "Aguardando envio",
  enviada: "Enviada",
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

  // Fluxo copiloto
  const [prepLoadingId, setPrepLoadingId] = useState<string | null>(null);
  const [sendLoadingId, setSendLoadingId] = useState<string | null>(null);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [preparedApps, setPreparedApps] = useState<Record<string, PreparedAppUI>>(
    {},
  );

  // Propostas de exemplo
  const [propLoadingId, setPropLoadingId] = useState<string | null>(null);
  const [propError, setPropError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Record<string, ProposalResult>>({});

  // Tracker
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [funnel, setFunnel] = useState<Record<string, number> | null>(null);
  const [trackerItems, setTrackerItems] = useState<TrackerItemUI[]>([]);
  const [respondLoadingId, setRespondLoadingId] = useState<string | null>(null);

  const loadTracker = useCallback(async () => {
    setTrackerLoading(true);
    try {
      const res = await fetch(`/api/applications/list?userId=${userId}`);
      const data = await res.json();
      if (res.ok) {
        setFunnel(data.funnel);
        setTrackerItems(data.items);
      }
    } finally {
      setTrackerLoading(false);
    }
  }, [userId]);

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
    setSendLoadingId(externalId);
    setCopilotError(null);
    try {
      const res = await fetch("/api/applications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: app.applicationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setPreparedApps((prev) => ({
        ...prev,
        [externalId]: { ...prev[externalId], status: data.status },
      }));
      await loadTracker();
    } catch (err) {
      setCopilotError((err as Error).message);
    } finally {
      setSendLoadingId(null);
    }
  }

  async function generateProposal(jobId: string) {
    setPropLoadingId(jobId);
    setPropError(null);
    try {
      const res = await fetch("/api/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setProposals((prev) => ({ ...prev, [jobId]: data.proposal }));
    } catch (err) {
      setPropError((err as Error).message);
    } finally {
      setPropLoadingId(null);
    }
  }

  async function simulateResponse(applicationId: string) {
    setRespondLoadingId(applicationId);
    try {
      await fetch("/api/applications/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      await loadTracker();
    } finally {
      setRespondLoadingId(null);
    }
  }

  if (loadingProfile) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-gray-500">
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
          className="mt-4 rounded-lg bg-black px-6 py-3 font-medium text-white"
        >
          ← Voltar ao início
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Stepper current="vagas" userId={userId} />

      <div className="mt-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Vagas e candidaturas</h1>
          <p className="mt-2 text-gray-500">
            A IA busca vagas, pontua a compatibilidade e prepara propostas no
            modelo copiloto.
          </p>
        </div>
        <button
          onClick={() => router.push(`/portfolio/${userId}`)}
          className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:border-black"
        >
          ← Portfólio
        </button>
      </div>

      {/* Caça de vagas */}
      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">Caça de vagas (Freelancer.com)</h2>
        <p className="text-gray-500">
          Vagas com compatibilidade abaixo de 60 são descartadas.
        </p>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3">
          {fcConnected ? (
            <>
              <span className="text-sm font-medium text-green-700">
                ✓ Conectado ao Freelancer — busca de vagas reais ativa
              </span>
              <a
                href={`/perfil-freelancer/${userId}`}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:border-black"
              >
                Otimizar perfil →
              </a>
            </>
          ) : fcConfigured ? (
            <>
              <span className="text-sm text-gray-600">
                Conecte sua conta do Freelancer para buscar vagas reais.
              </span>
              <a
                href={`/api/freelancer/connect?userId=${userId}`}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
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
          className="rounded-lg bg-black px-6 py-3 font-medium text-white disabled:opacity-50"
        >
          {huntLoading ? "Buscando vagas..." : "Buscar vagas"}
        </button>

        {(huntLoading || huntLog.length > 0) && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
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
            <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
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
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{job.titulo}</p>
                      <p className="text-sm text-gray-500">{job.motivo}</p>
                      {job.budget && (
                        <p className="mt-1 text-xs text-gray-400">
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
                            : "bg-gray-100 text-gray-500"
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
                      className="mt-3 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {prepLoadingId === job.externalId
                        ? "Preparando..."
                        : "Preparar candidatura"}
                    </button>
                  )}

                  {app && (
                    <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase text-gray-400">
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
                      <p className="whitespace-pre-wrap text-sm">
                        {app.proposta}
                      </p>
                      <p className="text-xs text-gray-500">
                        Valor: {app.valorSugerido} · Prazo: {app.prazoSugerido}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(app.proposta)
                          }
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        >
                          Copiar proposta
                        </button>
                        {app.status !== "enviada" && (
                          <button
                            onClick={() => sendApp(job.externalId)}
                            disabled={sendLoadingId === job.externalId}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {sendLoadingId === job.externalId
                              ? "Registrando..."
                              : "Marcar como enviada"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Acompanhamento */}
      <section className="mt-12 space-y-4 border-t border-gray-200 pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Acompanhamento</h2>
          <button
            onClick={loadTracker}
            disabled={trackerLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            {trackerLoading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {funnel && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["aguardando_envio", "enviada", "respondida", "rascunho"] as const).map(
              (k) => (
                <div
                  key={k}
                  className="rounded-lg border border-gray-200 p-3 text-center"
                >
                  <div className="text-2xl font-bold">{funnel[k] ?? 0}</div>
                  <div className="text-xs text-gray-500">{STATUS_LABEL[k]}</div>
                </div>
              ),
            )}
          </div>
        )}

        {trackerItems.length > 0 && (
          <ul className="space-y-2">
            {trackerItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{item.titulo}</p>
                  <p className="text-xs text-gray-400">
                    {item.canal} · {item.modoEnvio}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      item.status === "respondida"
                        ? "bg-blue-100 text-blue-700"
                        : item.status === "enviada"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                  {item.status === "enviada" && (
                    <button
                      onClick={() => simulateResponse(item.id)}
                      disabled={respondLoadingId === item.id}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-xs disabled:opacity-50"
                    >
                      {respondLoadingId === item.id ? "..." : "Simular resposta"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Propostas de exemplo */}
      <section className="mt-12 space-y-4 border-t border-gray-200 pt-8">
        <h2 className="text-2xl font-semibold">
          Testar proposta (vagas de exemplo)
        </h2>
        <p className="text-gray-500">
          A IA estuda a vaga e escreve uma proposta personalizada com base no seu
          perfil e portfólio.
        </p>

        {propError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
            {propError}
          </div>
        )}

        <div className="space-y-4">
          {EXAMPLE_JOBS.map((job) => {
            const proposal = proposals[job.id];
            return (
              <div key={job.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{job.titulo}</p>
                    <p className="text-sm text-gray-400">{job.budget}</p>
                  </div>
                  <button
                    onClick={() => generateProposal(job.id)}
                    disabled={propLoadingId === job.id}
                    className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {propLoadingId === job.id
                      ? "Escrevendo..."
                      : proposal
                        ? "Regerar"
                        : "Gerar proposta"}
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-600">{job.descricao}</p>

                {proposal && (
                  <div className="mt-4 space-y-3 rounded-lg bg-gray-50 p-4">
                    <p className="whitespace-pre-wrap text-sm">
                      {proposal.proposta}
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
                      <span>
                        <strong>Valor:</strong> {proposal.valorSugerido}
                      </span>
                      <span>
                        <strong>Prazo:</strong> {proposal.prazoSugerido}
                      </span>
                    </div>
                    {proposal.pontosFortes?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {proposal.pontosFortes.map((p) => (
                          <span
                            key={p}
                            className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-700"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
