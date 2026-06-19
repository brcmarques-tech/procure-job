"use client";

export interface ProfileResult {
  area: string;
  skills: string[];
  resumoBio: string;
  experiencias: { titulo: string; descricao: string; periodo?: string }[];
  keywordsBusca: string[];
}

/** Resumo compacto do perfil, reaproveitado entre telas. */
export default function ProfileSummary({
  nome,
  profile,
}: {
  nome?: string;
  profile: ProfileResult;
}) {
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div>
        {nome && (
          <p className="text-lg font-bold text-[#151D26]">{nome}</p>
        )}
        <p className="text-sm font-medium text-[#3398DB]">{profile.area}</p>
      </div>
      <p className="text-sm text-slate-600">{profile.resumoBio}</p>
      <div className="flex flex-wrap gap-2">
        {profile.skills.map((s) => (
          <span
            key={s}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
          >
            {s}
          </span>
        ))}
      </div>
    </section>
  );
}
