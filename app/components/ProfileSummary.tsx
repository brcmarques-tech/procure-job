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
    <section className="space-y-5 rounded-2xl border border-gray-200 p-6">
      <div>
        {nome && <p className="text-lg font-semibold">{nome}</p>}
        <p className="text-sm text-gray-500">{profile.area}</p>
      </div>
      <p className="text-sm">{profile.resumoBio}</p>
      <div className="flex flex-wrap gap-2">
        {profile.skills.map((s) => (
          <span
            key={s}
            className="rounded-full bg-gray-100 px-3 py-1 text-xs"
          >
            {s}
          </span>
        ))}
      </div>
    </section>
  );
}
