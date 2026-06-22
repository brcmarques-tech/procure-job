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
      {items.map((it, i) => {
        // Em 2 colunas (mobile), o último item de uma contagem ÍMPAR ocupa a
        // linha inteira (centralizado) em vez de deixar uma célula vazia ao lado.
        const oddLast = i === items.length - 1 && items.length % 2 === 1;
        return (
        <div
          key={it.label}
          className={[
            "px-3 py-4 text-center sm:px-5 sm:py-7",
            oddLast ? "col-span-2 sm:col-span-1" : "",
            i > 0
              ? oddLast
                ? "sm:border-l border-[#EBEBEB]"
                : "border-l border-[#EBEBEB]"
              : "",
            i >= 2 ? "border-t border-[#EBEBEB] sm:border-t-0" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="text-xl font-bold tracking-tight text-[#151D26] sm:text-3xl md:text-4xl">
            {it.value}
          </div>
          <div className="mt-1 text-sm text-[#517193]">{it.label}</div>
        </div>
        );
      })}
    </div>
  );
}
