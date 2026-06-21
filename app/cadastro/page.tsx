"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CadastroPage() {
  const router = useRouter();
  const [master, setMaster] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/accounts/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ master, nome, senha }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Não foi possível criar a conta.");
      }
      router.push("/onboarding");
    } catch (err) {
      setErro((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 sm:px-6">
      <form
        onSubmit={criar}
        className="w-full max-w-sm border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Procure.job" className="h-8 w-auto" />
        <h1 className="mt-2 text-2xl font-bold text-[#151D26]">Criar conta</h1>
        <p className="mt-1 text-sm text-slate-500">
          O cadastro é protegido por uma senha mestre. Cada conta vê apenas os
          próprios perfis.
        </p>

        <label className="mt-6 block text-sm text-slate-600">
          Senha mestre
          <input
            type="password"
            value={master}
            onChange={(e) => setMaster(e.target.value)}
            autoFocus
            required
            className="mt-1 block w-full border border-slate-300 px-4 py-2 outline-none focus:border-[#3398DB]"
          />
        </label>

        <label className="mt-4 block text-sm text-slate-600">
          Nome da conta
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            autoComplete="username"
            className="mt-1 block w-full border border-slate-300 px-4 py-2 outline-none focus:border-[#3398DB]"
          />
        </label>

        <label className="mt-4 block text-sm text-slate-600">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            autoComplete="new-password"
            className="mt-1 block w-full border border-slate-300 px-4 py-2 outline-none focus:border-[#3398DB]"
          />
        </label>

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full bg-[#3398DB] px-6 py-3 font-semibold text-white transition hover:bg-[#2b82c2] disabled:opacity-50"
        >
          {loading ? "Criando..." : "Criar conta"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-[#3398DB] hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}
