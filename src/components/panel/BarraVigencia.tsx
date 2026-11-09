/**
 * DETALLE #22: la barra de vigencia. Cuánto le queda de cuota, contra un tramo de 30 días (si le queda más, está llena).
 * El color es el del semáforo de la puerta y siempre va acompañado del texto con los días: nunca solo color.
 * `venceEn` es el fin de la cobertura (medianoche siguiente al último día cubierto), como lo da la base.
 */
const COLOR: Record<string, string> = { verde: "var(--verde)", amarillo: "var(--amarillo)", naranja: "var(--naranja)", rojo: "var(--rojo)" };

export function BarraVigencia({ venceEn, color, ahora = Date.now() }: { venceEn: string | null; color: string; ahora?: number }) {
  if (!venceEn) return null;
  const dias = Math.ceil((new Date(venceEn).getTime() - ahora) / 86400000);
  const queda = Math.max(0, Math.min(30, dias));
  const texto = dias > 1 ? `Le quedan ${dias} días` : dias === 1 ? "Le queda 1 día" : dias === 0 ? "Vence hoy" : `Venció hace ${-dias} ${dias === -1 ? "día" : "días"}`;
  return (
    <div className="max-w-sm" data-barra-vigencia={dias}>
      <div className="h-2 rounded-full bg-[var(--tarjeta-alta)] overflow-hidden" role="progressbar" aria-label="Vigencia de la cuota" aria-valuemin={0} aria-valuemax={30} aria-valuenow={queda} aria-valuetext={texto}>
        <div className="h-full rounded-full" style={{ width: `${(queda / 30) * 100}%`, background: COLOR[color] ?? "var(--acento)" }} />
      </div>
      <p className="texto-suave text-sm mt-1">{texto}</p>
    </div>
  );
}
