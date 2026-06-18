"use client";

import { useState } from "react";
import { EXAMPLE_JOBS } from "@/lib/exampleJobs";

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

interface ProfileResult {
  area: string;
  skills: string[];
  resumoBio: string;
  experiencias: { titulo: string; descricao: string; periodo?: string }[];
  keywordsBusca: string[];
}

export default function OnboardingPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Portfólio (M2)
  const [pfLoading, setPfLoading] = useState(false);
  const [pfError, setPfError] = useState<string | null>(null);
  const [pfSlug, setPfSlug] = useState<string | null>(null);
  const [pfDoc, setPfDoc] = useState<string | null>(null);
  const [instrucoes, setInstrucoes] = useState("");

  // Propostas (M4)
  const [propLoadingId, setPropLoadingId] = useState<string | null>(null);
  const [propError, setPropError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Record<string, ProposalResult>>({});

  // Caça de vagas (M3)
  const [huntLoading, setHuntLoading] = useState(false);
  const [huntError, setHuntError] = useState<string | null>(null);
  const [huntMode, setHuntMode] = useState<string | null>(null);
  const [huntedJobs, setHuntedJobs] = useState<HuntedJobUI[]>([]);

  // Fluxo copiloto (M5)
  const [prepLoadingId, setPrepLoadingId] = useState<string | null>(null);
  const [sendLoadingId, setSendLoadingId] = useState<string | null>(null);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [preparedApps, setPreparedApps] = useState<
    Record<string, PreparedAppUI>
  >({});

  // Tracker (M6)
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [funnel, setFunnel] = useState<Record<string, number> | null>(null);
  const [trackerItems, setTrackerItems] = useState<TrackerItemUI[]>([]);
  const [respondLoadingId, setRespondLoadingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setUserId(null);
    setPfSlug(null);
    setPfDoc(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, rawInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setResult(data.profile);
      setUserId(data.userId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function generatePortfolio() {
    if (!userId) return;
    setPfLoading(true);
    setPfError(null);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          instrucoes: instrucoes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setPfSlug(data.slug);
      setPfDoc(`<style>${data.css}</style>${data.html}`);
    } catch (err) {
      setPfError((err as Error).message);
    } finally {
      setPfLoading(false);
    }
  }

  async function generateProposal(jobId: string) {
    if (!userId) return;
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

  async function runHunt() {
    if (!userId) return;
    setHuntLoading(true);
    setHuntError(null);
    try {
      const res = await fetch("/api/jobs/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setHuntMode(data.mode);
      setHuntedJobs(data.jobs);
    } catch (err) {
      setHuntError((err as Error).message);
    } finally {
      setHuntLoading(false);
    }
  }

  async function prepareApp(externalId: string) {
    if (!userId) return;
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
    } catch (err) {
      setCopilotError((err as Error).message);
    } finally {
      setSendLoadingId(null);
    }
  }

  async function loadTracker() {
    if (!userId) return;
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

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold">Procure.job</h1>
      <p className="mt-2 text-gray-500">
        Conte sobre você. A IA vai estruturar seu perfil profissional.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-black"
          />
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-black"
          />
        </div>
        <textarea
          placeholder="Cole seu currículo ou descreva o que você faz, suas habilidades e experiências..."
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          required
          rows={10}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-black px-6 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Gerando perfil..." : "Gerar meu perfil"}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {result && (
        <section className="mt-10 space-y-6">
          <h2 className="text-2xl font-semibold">Perfil gerado</h2>

          <div>
            <h3 className="text-sm font-medium uppercase text-gray-400">Área</h3>
            <p className="text-lg">{result.area}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium uppercase text-gray-400">Resumo</h3>
            <p>{result.resumoBio}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium uppercase text-gray-400">Skills</h3>
            <div className="mt-1 flex flex-wrap gap-2">
              {result.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium uppercase text-gray-400">
              Experiências
            </h3>
            <ul className="mt-1 space-y-3">
              {result.experiencias.map((exp, i) => (
                <li key={i} className="rounded-lg border border-gray-200 p-3">
                  <p className="font-medium">
                    {exp.titulo}
                    {exp.periodo && (
                      <span className="ml-2 text-sm text-gray-400">
                        {exp.periodo}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">{exp.descricao}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium uppercase text-gray-400">
              Palavras-chave para busca de vagas
            </h3>
            <div className="mt-1 flex flex-wrap gap-2">
              {result.keywordsBusca.map((k) => (
                <span
                  key={k}
                  className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {result && (
        <section className="mt-12 space-y-4 border-t border-gray-200 pt-8">
          <h2 className="text-2xl font-semibold">Portfólio</h2>
          <p className="text-gray-500">
            Gere um site-portfólio a partir do seu perfil. Você pode pedir
            ajustes e regenerar.
          </p>

          <textarea
            placeholder="Ajustes opcionais (ex.: estilo minimalista, cores escuras, destaque para projetos)..."
            value={instrucoes}
            onChange={(e) => setInstrucoes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-black"
          />

          <button
            onClick={generatePortfolio}
            disabled={pfLoading}
            className="rounded-lg bg-black px-6 py-3 font-medium text-white disabled:opacity-50"
          >
            {pfLoading
              ? "Gerando portfólio..."
              : pfSlug
                ? "Regenerar portfólio"
                : "Gerar portfólio"}
          </button>

          {pfError && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
              {pfError}
            </div>
          )}

          {pfDoc && (
            <div className="space-y-3">
              {pfSlug && (
                <a
                  href={`/p/${pfSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-blue-600 underline"
                >
                  Abrir portfólio em nova aba → /p/{pfSlug}
                </a>
              )}
              <iframe
                title="Pré-visualização do portfólio"
                srcDoc={pfDoc}
                className="h-[600px] w-full rounded-lg border border-gray-300"
              />
            </div>
          )}
        </section>
      )}

      {result && (
        <section className="mt-12 space-y-4 border-t border-gray-200 pt-8">
          <h2 className="text-2xl font-semibold">
            Caça de vagas (Freelancer.com)
          </h2>
          <p className="text-gray-500">
            A IA busca vagas e pontua a compatibilidade com seu perfil (0–100).
            Vagas abaixo de 60 são descartadas.
          </p>

          <button
            onClick={runHunt}
            disabled={huntLoading}
            className="rounded-lg bg-black px-6 py-3 font-medium text-white disabled:opacity-50"
          >
            {huntLoading ? "Buscando vagas..." : "Buscar vagas"}
          </button>

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
      )}

      {result && (
        <section className="mt-12 space-y-4 border-t border-gray-200 pt-8">
          <h2 className="text-2xl font-semibold">
            Testar candidatura (vagas de exemplo)
          </h2>
          <p className="text-gray-500">
            A IA estuda a vaga e escreve uma proposta personalizada com base no
            seu perfil e portfólio.
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
                <div
                  key={job.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
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
      )}

      {result && (
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
                    <div className="text-xs text-gray-500">
                      {STATUS_LABEL[k]}
                    </div>
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
                        {respondLoadingId === item.id
                          ? "..."
                          : "Simular resposta"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
