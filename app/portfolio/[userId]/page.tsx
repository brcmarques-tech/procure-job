"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Stepper from "@/app/components/Stepper";
import ProfileSummary, {
  type ProfileResult,
} from "@/app/components/ProfileSummary";

export default function PortfolioPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const [nome, setNome] = useState<string>();
  const [profile, setProfile] = useState<ProfileResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [pfLoading, setPfLoading] = useState(false);
  const [pfError, setPfError] = useState<string | null>(null);
  const [pfSlug, setPfSlug] = useState<string | null>(null);
  const [pfDoc, setPfDoc] = useState<string | null>(null);
  const [instrucoes, setInstrucoes] = useState("");

  // Imagens geradas (Magnific) a partir de fotos de referência
  type GenImage = { role: string; url: string };
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [images, setImages] = useState<GenImage[]>([]);
  const [regenRole, setRegenRole] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`/api/profile?userId=${userId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao carregar.");
        if (cancel) return;
        setNome(data.nome);
        setProfile(data.profile);
        if (data.portfolio) {
          setPfSlug(data.portfolio.slug);
          if (data.portfolio.html) {
            setPfDoc(
              `<style>${data.portfolio.css}</style>${data.portfolio.html}`,
            );
          }
          if (Array.isArray(data.portfolio.images)) {
            setImages(data.portfolio.images);
          }
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
  }, [userId]);

  const generateImages = useCallback(async () => {
    if (refFiles.length < 1) {
      setImgError("Selecione de 1 a 4 fotos suas.");
      return;
    }
    setImgLoading(true);
    setImgError(null);
    try {
      const fd = new FormData();
      fd.append("userId", userId);
      refFiles.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/portfolio/images", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar imagens.");
      setImages(data.images);
    } catch (err) {
      setImgError((err as Error).message);
    } finally {
      setImgLoading(false);
    }
  }, [userId, refFiles]);

  const regenOne = useCallback(
    async (role: string) => {
      setRegenRole(role);
      setImgError(null);
      try {
        const res = await fetch("/api/portfolio/images/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, role }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao regenerar.");
        setImages(data.images);
      } catch (err) {
        setImgError((err as Error).message);
      } finally {
        setRegenRole(null);
      }
    },
    [userId],
  );

  const generatePortfolio = useCallback(async () => {
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
  }, [userId, instrucoes]);

  if (loadingProfile) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-gray-500">
        Carregando perfil...
      </main>
    );
  }

  if (loadError || !profile) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Stepper current="portfolio" />
        <div className="mt-8 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
          {loadError ?? "Perfil não encontrado."}
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
      <Stepper current="portfolio" userId={userId} />

      <div className="mt-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Seu portfólio</h1>
          <p className="mt-2 text-gray-500">
            Gere um site-portfólio a partir do seu perfil. Peça ajustes e
            regenere até ficar do seu jeito.
          </p>
        </div>
        <button
          onClick={() => router.push(`/vagas/${userId}`)}
          className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:border-black"
        >
          Buscar vagas →
        </button>
      </div>

      <div className="mt-8">
        <ProfileSummary nome={nome} profile={profile} />
      </div>

      {/* Imagens do portfólio a partir de fotos suas */}
      <section className="mt-8 space-y-4 rounded-2xl border border-gray-200 p-6">
        <div>
          <h2 className="text-xl font-semibold">Imagens do portfólio</h2>
          <p className="mt-1 text-sm text-gray-500">
            Envie de 1 a 4 fotos suas (rosto bem visível). A IA cria 3 imagens
            profissionais com você, no contexto da sua área, pra usar no
            portfólio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:border-black">
            Selecionar fotos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) =>
                setRefFiles(Array.from(e.target.files ?? []).slice(0, 4))
              }
            />
          </label>
          {refFiles.length > 0 && (
            <span className="text-sm text-gray-500">
              {refFiles.length} foto(s): {refFiles.map((f) => f.name).join(", ")}
            </span>
          )}
          <button
            onClick={generateImages}
            disabled={imgLoading}
            className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {imgLoading
              ? "Gerando imagens (~1 min)..."
              : images.length
                ? "Regerar imagens"
                : "Gerar imagens"}
          </button>
        </div>

        {imgError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {imgError}
          </div>
        )}

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {images.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <figure key={img.role} className="space-y-1">
                <img
                  src={img.url}
                  alt={img.role}
                  className="aspect-[3/4] w-full rounded-lg border border-gray-200 object-cover"
                />
                <figcaption className="flex items-center justify-between text-xs text-gray-400">
                  <span>{img.role}</span>
                  <button
                    onClick={() => regenOne(img.role)}
                    disabled={regenRole !== null || imgLoading}
                    className="rounded border border-gray-300 px-2 py-0.5 text-gray-600 hover:border-black disabled:opacity-50"
                  >
                    {regenRole === img.role ? "..." : "Regerar esta"}
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        {images.length > 0 && (
          <p className="text-xs text-gray-500">
            Pronto! Agora gere (ou regenere) o portfólio abaixo — ele vai usar
            essas imagens.
          </p>
        )}
      </section>

      <section className="mt-8 space-y-4">
        <textarea
          placeholder="Ajustes opcionais (ex.: cores escuras, destaque para projetos, mais minimalista)..."
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

      {pfDoc && (
        <div className="mt-10 flex justify-end">
          <button
            onClick={() => router.push(`/vagas/${userId}`)}
            className="rounded-lg bg-black px-6 py-3 font-medium text-white"
          >
            Próximo: buscar vagas →
          </button>
        </div>
      )}
    </main>
  );
}
