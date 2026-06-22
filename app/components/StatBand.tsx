/**
 * Banda de estatísticas — células quadradas separadas por fios #EBEBEB,
 * no estilo "Our Impact" do template. `cols` controla as colunas no desktop.
 */
export default function StatBand({
  items,
  cols = "sm:grid-cols-4",
}: {
  items: { value: string | number; label: string }[];
  cols?: string;
}) {
  return (
    <div
      className={`grid grid-cols-2 border border-[#EBEBEB] bg-white ${cols}`}
    >
      {items.map((it, i) => (
        <div
          key={it.label}
          className={`px-3 py-5 text-center sm:px-5 sm:py-7 ${
            i > 0 ? "border-l border-[#EBEBEB]" : ""
          } ${i >= 2 ? "border-t border-[#EBEBEB] sm:border-t-0" : ""}`}
        >
          <div className="text-xl font-bold tracking-tight text-[#151D26] sm:text-3xl md:text-4xl">
            {it.value}
          </div>
          <div className="mt-1 text-sm text-[#517193]">{it.label}</div>
        </div>
      ))}
    </div>
  );
}
