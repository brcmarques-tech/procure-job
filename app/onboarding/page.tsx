"use client";

import { useState } from "react";
import { EXAMPLE_JOBS } from "@/lib/exampleJobs";

interface ProposalResult {
  proposta: string;
  valorSugerido: string;
  prazoSugerido: string;
  pontosFortes: string[];
}

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
    </main>
  );
}
