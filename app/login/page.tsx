"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Senha incorreta.");
      }
      const next =
        new URLSearchParams(window.location.search).get("next") || "/onboarding";
      router.push(next);
    } catch (err) {
      setErro((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm border border-slate-200 bg-white p-8 shadow-sm"
      >
        <p className="eyebrow">Procure.job</p>
        <h1 className="mt-2 text-2xl font-bold text-[#151D26]">Acesso à ferramenta</h1>
        <p className="mt-1 text-sm text-slate-500">
          Os portfólios são públicos; a ferramenta é protegida por senha.
        </p>

        <label className="mt-6 block text-sm text-slate-600">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoFocus
            required
            className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-[#3398DB]"
          />
        </label>

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-[#3398DB] px-6 py-3 font-semibold text-white transition hover:bg-[#2b82c2] disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
