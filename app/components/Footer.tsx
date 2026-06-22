"use client";

/**
 * Banda CTA + rodapé escura (navy #151D26), no estilo do template corporate.
 * Fecha cada tela como um site de verdade. CTA opcional.
 */
export default function Footer({
  ctaTitle,
  ctaLabel,
  onCta,
}: {
  ctaTitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <footer className="mt-16 bg-[#151D26] text-white">
      <div className="mx-auto max-w-5xl px-6 py-14">
        {ctaTitle && (
          <div className="flex flex-col items-start justify-between gap-6 border-b border-white/10 pb-12 sm:flex-row sm:items-center">
            <h2 className="max-w-md text-2xl font-bold tracking-tight sm:text-3xl">
              {ctaTitle}
            </h2>
            {ctaLabel && onCta && (
              <button
                onClick={onCta}
                className="w-full bg-[#3398DB] px-6 py-3 font-semibold text-white transition hover:bg-[#2b82c2] sm:w-auto"
              >
                {ctaLabel}
              </button>
            )}
          </div>
        )}
        <div className="flex flex-col gap-6 pt-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-lg font-bold">Procure.job</p>
            <p className="mt-1 max-w-xs text-sm text-white/50">
              IA que encontra vagas e prepara suas candidaturas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/60">
            <span className="eyebrow !text-white/40">Fluxo</span>
            <span>1. Perfil</span>
            <span className="text-white/25">/</span>
            <span>2. Portfólio</span>
            <span className="text-white/25">/</span>
            <span>3. Vagas</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
