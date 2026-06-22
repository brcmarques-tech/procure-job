"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface SkillUI {
  id: number;
  name: string;
}

interface FreelancerProfileUI {
  id: number;
  username: string;
  tagline: string | null;
  profileDescription: string | null;
  jobs: SkillUI[];
}

interface OptimizationUI {
  headline: string;
  bio: string;
  resumoMudancas: string[];
  skills: SkillUI[];
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:border-black sm:px-3 sm:py-1.5"
    >
      {copied ? "✓ Copiado" : label}
    </button>
  );
}

export default function PerfilFreelancerPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [profile, setProfile] = useState<FreelancerProfileUI | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [optLoading, setOptLoading] = useState(false);
  const [opt, setOpt] = useState<OptimizationUI | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const [applyLoading, setApplyLoading] = useState(false);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/freelancer/profile?userId=${userId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar.");
      setConnected(Boolean(data.connected));
      setProfile(data.profile ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function runOptimize() {
    setOptLoading(true);
    setError(null);
    setApplyMsg(null);
    try {
      const res = await fetch("/api/freelancer/profile/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao otimizar.");
      setOpt(data);
      // Por padrão, todas as skills sugeridas vêm marcadas.
      const sel: Record<number, boolean> = {};
      for (const s of data.skills as SkillUI[]) sel[s.id] = true;
      setSelected(sel);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOptLoading(false);
    }
  }

  async function applySkills() {
    if (!opt) return;
    const addIds = opt.skills.filter((s) => selected[s.id]).map((s) => s.id);
    if (!addIds.length) {
      setApplyMsg("Selecione ao menos uma skill.");
      return;
    }
    setApplyLoading(true);
    setApplyMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/freelancer/profile/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, addIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao aplicar.");
      // Atualiza skills atuais e remove as aplicadas da lista de sugestões.
      setProfile((prev) => (prev ? { ...prev, jobs: data.jobs } : prev));
      setOpt((prev) =>
        prev
          ? { ...prev, skills: prev.skills.filter((s) => !addIds.includes(s.id)) }
          : prev,
      );
      setApplyMsg(`✓ ${addIds.length} skill(s) adicionada(s) ao seu perfil.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApplyLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-gray-500 sm:px-6">
        Carregando seu perfil do Freelancer...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Otimizar perfil do Freelancer</h1>
          <p className="mt-2 text-gray-500">
            A IA usa tudo que sabe sobre você para deixar seu perfil mais
            atraente. Você aprova antes de qualquer mudança.
          </p>
        </div>
        <button
          onClick={() => router.push(`/vagas/${userId}`)}
          className="shrink-0 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium hover:border-black sm:py-2"
        >
          ← Vagas
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {!connected ? (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800">
          Você ainda não conectou sua conta do Freelancer.{" "}
          <a
            href={`/api/freelancer/connect?userId=${userId}`}
            className="font-medium underline"
          >
            Conectar agora
          </a>
        </div>
      ) : (
        <>
          {/* Perfil atual */}
          {profile && (
            <section className="mt-8 rounded-lg border border-gray-200 p-4 sm:p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                Perfil atual — @{profile.username}
              </h2>
              <p className="mt-3 text-sm">
                <strong>Headline:</strong> {profile.tagline || "(vazio)"}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                {profile.profileDescription || "(sem bio)"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.jobs.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          <button
            onClick={runOptimize}
            disabled={optLoading}
            className="mt-6 rounded-lg bg-black px-6 py-3 font-medium text-white disabled:opacity-50"
          >
            {optLoading
              ? "IA analisando seu perfil..."
              : opt
                ? "Otimizar de novo"
                : "Otimizar com IA"}
          </button>

          {opt && (
            <div className="mt-8 space-y-8">
              {/* Resumo das mudanças */}
              {opt.resumoMudancas?.length > 0 && (
                <section className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                  <h3 className="font-semibold">O que a IA melhorou</h3>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600">
                    {opt.resumoMudancas.map((m, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-green-600">✓</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Skills para aplicar (via API) */}
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">
                    Skills para adicionar
                  </h3>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-700">
                    aplica automático
                  </span>
                </div>
                {opt.skills.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">
                    Nenhuma skill nova sugerida — seu perfil já cobre bem.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-gray-500">
                      Selecione as que quer adicionar ao seu perfil real.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {opt.skills.map((s) => (
                        <label
                          key={s.id}
                          className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                            selected[s.id]
                              ? "border-black bg-black text-white"
                              : "border-gray-300 text-gray-600"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={Boolean(selected[s.id])}
                            onChange={(e) =>
                              setSelected((prev) => ({
                                ...prev,
                                [s.id]: e.target.checked,
                              }))
                            }
                          />
                          {selected[s.id] ? "✓ " : "+ "}
                          {s.name}
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={applySkills}
                      disabled={applyLoading}
                      className="mt-4 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {applyLoading
                        ? "Aplicando..."
                        : "Aplicar skills no meu perfil"}
                    </button>
                  </>
                )}
                {applyMsg && (
                  <p className="mt-3 text-sm font-medium text-green-700">
                    {applyMsg}
                  </p>
                )}
              </section>

              {/* Headline (copiar e colar) */}
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">Nova headline</h3>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                    copiar e colar no site
                  </span>
                </div>
                <div className="mt-2 flex items-start gap-3 rounded-lg border border-gray-200 p-4">
                  <p className="flex-1 text-sm font-medium">{opt.headline}</p>
                  <CopyButton text={opt.headline} label="Copiar" />
                </div>
              </section>

              {/* Bio (copiar e colar) */}
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">Nova bio</h3>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                    copiar e colar no site
                  </span>
                </div>
                <div className="mt-2 rounded-lg border border-gray-200 p-4">
                  <p className="whitespace-pre-wrap text-sm text-gray-700">
                    {opt.bio}
                  </p>
                  <div className="mt-3">
                    <CopyButton text={opt.bio} label="Copiar bio" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Bio e headline não são editáveis pela API do Freelancer — cole
                  no seu perfil em freelancer.com → Settings → Profile.
                </p>
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
