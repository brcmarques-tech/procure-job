"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Stepper from "@/app/components/Stepper";
import StatBand from "@/app/components/StatBand";
import Footer from "@/app/components/Footer";

export default function OnboardingPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload de CV em PDF
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvFileName, setCvFileName] = useState<string | null>(null);

  // Etapa de follow-up: perguntas para completar um perfil raso.
  const [userId, setUserId] = useState<string | null>(null);
  const [lacunas, setLacunas] = useState<string[]>([]);
  const [respostas, setRespostas] = useState<string[]>([]);

  async function handleCvUpload(file: File) {
    setCvLoading(true);
    setCvError(null);
    setCvFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/cv/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao ler o PDF.");
      setRawInput((prev) =>
        prev.trim() ? `${prev.trim()}\n\n${data.text}` : data.text,
      );
    } catch (err) {
      setCvError((err as Error).message);
      setCvFileName(null);
    } finally {
      setCvLoading(false);
    }
  }

  /** Gera/atualiza o perfil a partir de um texto. Devolve { userId, lacunas }. */
  async function submitProfile(text: string) {
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, rawInput: text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
    return data as { userId: string; lacunas: string[] };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await submitProfile(rawInput);
      if (data.lacunas?.length) {
        // Perfil ainda raso: pergunta antes de seguir.
        setUserId(data.userId);
        setLacunas(data.lacunas);
        setRespostas(data.lacunas.map(() => ""));
        setLoading(false);
      } else {
        router.push(`/portfolio/${data.userId}`);
      }
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  /** Reenvia o perfil com as respostas do follow-up e segue para o portfólio. */
  async function handleComplete() {
    setLoading(true);
    setError(null);
    try {
      const extras = lacunas
        .map((q, i) => respostas[i]?.trim() && `${q}\n${respostas[i].trim()}`)
        .filter(Boolean)
        .join("\n\n");
      const combined = extras
        ? `${rawInput.trim()}\n\nRespostas adicionais:\n${extras}`
        : rawInput;
      const data = await submitProfile(combined);
      router.push(`/portfolio/${data.userId}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  // ---- Etapa de follow-up ----
  if (lacunas.length) {
    const algumaResposta = respostas.some((r) => r.trim());
    return (
      <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-6 pt-8">
        <Stepper current="perfil" />
      </div>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="eyebrow">Perfil · Completar</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#151D26]">
          Vamos deixar seu perfil forte
        </h1>
        <p className="mt-2 text-slate-500">
          Com mais alguns detalhes reais, seu portfólio fica muito mais
          convincente. Responda o que fizer sentido — nada é obrigatório, e a
          gente nunca inventa experiência por você.
        </p>

        <div className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {lacunas.map((q, i) => (
            <div key={i}>
              <label className="block text-sm font-medium text-slate-800">
                {q}
              </label>
              <textarea
                value={respostas[i] ?? ""}
                onChange={(e) =>
                  setRespostas((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })
                }
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-[#3398DB]"
              />
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={handleComplete}
            disabled={loading || !algumaResposta}
            className="rounded-lg bg-[#3398DB] px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-[#2b82c2] disabled:opacity-50"
          >
            {loading ? "Atualizando perfil..." : "Completar perfil →"}
          </button>
          <button
            onClick={() => userId && router.push(`/portfolio/${userId}`)}
            disabled={loading}
            className="text-sm text-slate-500 underline hover:text-[#3398DB] disabled:opacity-50"
          >
            Pular e ver portfólio
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}
      </main>

      <Footer />
    </div>
    );
  }

  // ---- Etapa inicial ----
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 pt-8">
        <Stepper current="perfil" />
      </div>

      {/* Hero claro com ilustração (estilo template) */}
      <header className="border-b border-[#EBEBEB] bg-gradient-to-bl from-[#fdece6] via-white to-white">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-8 px-6 py-16 md:grid-cols-[1fr_auto]">
          <div>
            <p className="eyebrow">Perfil · Passo 1</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#151D26] sm:text-5xl">
              Conte sobre você
            </h1>
            <p className="mt-4 max-w-lg text-[#517193]">
              A IA estrutura seu perfil profissional a partir do que você
              escrever (ou do seu CV) e, no próximo passo, gera seu portfólio.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/data-extraction.png"
            alt=""
            className="hidden w-[300px] justify-self-end md:block lg:w-[360px]"
          />
        </div>
      </header>

    <main className="mx-auto max-w-2xl px-6 py-12">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-[#3398DB]"
          />
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-[#3398DB]"
          />
        </div>

        <div className="rounded-lg border border-dashed border-slate-300 px-4 py-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
            <span className="text-sm text-slate-600">
              {cvLoading
                ? "Lendo o PDF..."
                : cvFileName
                  ? `✓ ${cvFileName} — texto adicionado abaixo`
                  : "Tem um CV em PDF? Envie e a IA lê pra você."}
            </span>
            <span className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:border-[#3398DB]">
              {cvFileName ? "Trocar PDF" : "Enviar PDF"}
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={cvLoading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCvUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          {cvError && <p className="mt-2 text-sm text-red-600">{cvError}</p>}
        </div>

        <textarea
          placeholder="Cole seu currículo ou descreva o que você faz, suas habilidades e experiências... (ou envie o PDF acima)"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          required
          rows={10}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#3398DB]"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-black px-6 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Gerando perfil..." : "Gerar meu perfil →"}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <div className="mt-10">
        <StatBand
          cols="sm:grid-cols-3"
          items={[
            { value: "4+", label: "Quadros de vaga" },
            { value: "3", label: "Etapas até aplicar" },
            { value: "IA", label: "Copiloto do início ao fim" },
          ]}
        />
      </div>
    </main>

      <Footer />
    </div>
  );
}
