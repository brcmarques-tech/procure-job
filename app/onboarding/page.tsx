"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Stepper from "@/app/components/Stepper";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, rawInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      // Vai para a tela do portfólio com o perfil já criado.
      router.push(`/portfolio/${data.userId}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Stepper current="perfil" />
      <h1 className="mt-8 text-3xl font-bold">Procure.job</h1>
      <p className="mt-2 text-gray-500">
        Conte sobre você. A IA vai estruturar seu perfil profissional e, no
        próximo passo, gerar seu portfólio.
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

        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
            <span className="text-sm text-gray-600">
              {cvLoading
                ? "Lendo o PDF..."
                : cvFileName
                  ? `✓ ${cvFileName} — texto adicionado abaixo`
                  : "Tem um CV em PDF? Envie e a IA lê pra você."}
            </span>
            <span className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:border-black">
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
          className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
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
    </main>
  );
}
