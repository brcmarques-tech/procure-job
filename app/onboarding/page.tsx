"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Stepper from "@/app/components/Stepper";
import StatBand from "@/app/components/StatBand";
import Footer from "@/app/components/Footer";

interface PerfilItem {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  linkedin: string | null;
  area: string | null;
  temPortfolio: boolean;
  portfolioSlug: string | null;
}

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

  // Central de perfis já criados
  const [perfis, setPerfis] = useState<PerfilItem[]>([]);
  const [perfisLoading, setPerfisLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    linkedin: "",
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [perfisMsg, setPerfisMsg] = useState<string | null>(null);
  const [perfisOpen, setPerfisOpen] = useState(false); // fechado por padrão

  // Conta logada (nome + botão Sair). null = modo aberto / sem login.
  const [contaNome, setContaNome] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setContaNome(d.nome ?? null))
      .catch(() => {});
  }, []);
  async function sair() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  const loadPerfis = useCallback(async () => {
    setPerfisLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (res.ok) setPerfis(data.users);
    } finally {
      setPerfisLoading(false);
    }
  }, []);
  useEffect(() => {
    loadPerfis();
  }, [loadPerfis]);

  function startEdit(p: PerfilItem) {
    setEditId(p.id);
    setPerfisMsg(null);
    setEditForm({
      nome: p.nome,
      email: p.email,
      telefone: p.telefone ?? "",
      linkedin: p.linkedin ?? "",
    });
  }

  async function saveEdit() {
    if (!editId) return;
    setBusyId(editId);
    setPerfisMsg(null);
    try {
      const res = await fetch("/api/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editId, ...editForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar.");
      setEditId(null);
      await loadPerfis();
      setPerfisMsg("Contato atualizado.");
    } catch (err) {
      setPerfisMsg((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function removePerfil(p: PerfilItem) {
    if (
      !confirm(
        `Excluir o perfil de ${p.nome} e tudo dele (portfólio, vagas, candidaturas)? Não dá pra desfazer.`,
      )
    )
      return;
    setBusyId(p.id);
    setPerfisMsg(null);
    try {
      const res = await fetch("/api/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: p.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir.");
      await loadPerfis();
    } catch (err) {
      setPerfisMsg((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

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
      <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
        <Stepper current="perfil" />
      </div>
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <p className="eyebrow">Perfil · Completar</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#151D26] sm:text-4xl">
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
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Procure.job" className="h-7 w-auto" />
      </div>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-3 sm:px-6 sm:pt-4">
        <Stepper current="perfil" />

        <div className="flex items-center gap-2 sm:gap-3">
        {/* Meus perfis — no mesmo nível do stepper, à direita; abre flutuando */}
        {(perfisLoading || perfis.length > 0) && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setPerfisOpen((o) => !o)}
              className="flex items-center gap-3 border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#151D26] shadow-sm transition hover:border-slate-300"
            >
              <span>
                Meus perfis
                {perfis.length > 0 && (
                  <span className="ml-1 text-slate-400">({perfis.length})</span>
                )}
              </span>
              <span className="text-slate-400">{perfisOpen ? "▴" : "▾"}</span>
            </button>

            {perfisOpen && (
              <div className="fixed inset-x-2 bottom-2 top-auto z-40 max-h-[75vh] w-auto space-y-2 overflow-auto border border-slate-200 bg-white p-3 shadow-lg safe-bottom sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[70vh] sm:w-[min(20rem,calc(100vw-2rem))] sm:p-3 sm:pb-3">
                {perfisMsg && (
                  <p className="text-xs text-slate-600">{perfisMsg}</p>
                )}
                {perfisLoading ? (
                  <p className="text-xs text-slate-400">Carregando...</p>
                ) : perfis.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum perfil ainda.</p>
                ) : (
                  perfis.map((p) => (
                    <div key={p.id} className="border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-[#151D26]">
                        {p.nome}
                      </p>
                      <p className="text-xs text-slate-500">
                        {p.area ?? "(sem área)"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {p.email}
                        {p.telefone ? ` · ${p.telefone}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          onClick={() => router.push(`/portfolio/${p.id}`)}
                          className="border border-[#3398DB] px-2.5 py-1.5 text-xs font-medium text-[#3398DB] transition hover:bg-[#3398DB] hover:text-white"
                        >
                          Portfólio
                        </button>
                        <button
                          onClick={() => router.push(`/vagas/${p.id}`)}
                          className="border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-slate-400"
                        >
                          Vagas
                        </button>
                        <button
                          title="Configurar contato"
                          onClick={() =>
                            editId === p.id ? setEditId(null) : startEdit(p)
                          }
                          className="border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-slate-400"
                        >
                          {editId === p.id ? "Fechar" : "⚙"}
                        </button>
                        <button
                          title="Excluir perfil"
                          onClick={() => removePerfil(p)}
                          disabled={busyId === p.id}
                          className="border border-slate-300 px-2.5 py-1.5 text-xs text-red-600 transition hover:border-red-400 disabled:opacity-50"
                        >
                          {busyId === p.id ? "..." : "🗑"}
                        </button>
                      </div>

                      {editId === p.id && (
                        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                          <input
                            value={editForm.nome}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, nome: e.target.value }))
                            }
                            placeholder="Nome"
                            className="block w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#3398DB]"
                          />
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                email: e.target.value,
                              }))
                            }
                            placeholder="Email"
                            className="block w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#3398DB]"
                          />
                          <input
                            value={editForm.telefone}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                telefone: e.target.value,
                              }))
                            }
                            placeholder="Telefone / WhatsApp"
                            className="block w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#3398DB]"
                          />
                          <input
                            value={editForm.linkedin}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                linkedin: e.target.value,
                              }))
                            }
                            placeholder="LinkedIn (URL)"
                            className="block w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#3398DB]"
                          />
                          <button
                            onClick={saveEdit}
                            disabled={busyId === p.id}
                            className="w-full bg-[#3398DB] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2b82c2] disabled:opacity-50"
                          >
                            {busyId === p.id ? "Salvando..." : "Salvar contato"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
        {contaNome && (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-[#517193] sm:inline">
              {contaNome}
            </span>
            <button
              type="button"
              onClick={sair}
              className="border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300"
            >
              Sair
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Hero claro com ilustração (estilo template) */}
      <header className="border-b border-[#EBEBEB] bg-gradient-to-bl from-[#fdece6] via-white to-white">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-6 px-4 py-10 sm:gap-8 sm:px-6 sm:py-16 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="eyebrow">Perfil · Passo 1</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#151D26] sm:text-4xl md:text-5xl">
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
            className="hidden w-[300px] justify-self-end lg:block lg:w-[360px]"
          />
        </div>
      </header>

    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
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
