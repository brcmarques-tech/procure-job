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
    <nav className="flex items-center gap-2 text-sm">
      {STEPS.map((s, i) => {
        const active = s.key === current;
        const to = href(s.key);
        const base =
          "rounded-full px-3 py-1 " +
          (active
            ? "bg-black text-white"
            : to
              ? "text-gray-600 hover:bg-gray-100"
              : "text-gray-300");
        return (
          <span key={s.key} className="flex items-center gap-2">
            {to && !active ? (
              <Link href={to} className={base}>
                {s.label}
              </Link>
            ) : (
              <span className={base}>{s.label}</span>
            )}
            {i < STEPS.length - 1 && <span className="text-gray-300">→</span>}
          </span>
        );
      })}
    </nav>
  );
}
