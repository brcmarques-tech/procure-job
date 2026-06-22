"use client";

import Link from "next/link";

type Step = "perfil" | "portfolio" | "vagas";

const STEPS: { key: Step; label: string }[] = [
  { key: "perfil", label: "1. Perfil" },
  { key: "portfolio", label: "2. Portfólio" },
  { key: "vagas", label: "3. Vagas" },
];

/**
 * Navegação por etapas do fluxo. As etapas já concluídas viram links
 * (precisa do userId); a etapa "perfil" sempre aponta para /onboarding.
 */
export default function Stepper({
  current,
  userId,
}: {
  current: Step;
  userId?: string;
}) {
  const href = (key: Step) => {
    if (key === "perfil") return "/onboarding";
    if (!userId) return null;
    return key === "portfolio" ? `/portfolio/${userId}` : `/vagas/${userId}`;
  };

  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs sm:gap-2 sm:text-sm">
      {STEPS.map((s, i) => {
        const active = s.key === current;
        const to = href(s.key);
        const base =
          "rounded-full px-2 py-1 font-medium sm:px-3 " +
          (active
            ? "bg-[#3398DB] text-white"
            : to
              ? "text-slate-600 hover:bg-slate-100"
              : "text-slate-300");
        return (
          <span key={s.key} className="flex items-center gap-1 sm:gap-2">
            {to && !active ? (
              <Link href={to} className={base}>
                {s.label}
              </Link>
            ) : (
              <span className={base}>{s.label}</span>
            )}
            {i < STEPS.length - 1 && <span className="text-slate-300">→</span>}
          </span>
        );
      })}
    </nav>
  );
}
