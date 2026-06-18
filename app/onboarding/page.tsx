"use client";

import { useState } from "react";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, rawInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setResult(data.profile);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
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
    </main>
  );
}
