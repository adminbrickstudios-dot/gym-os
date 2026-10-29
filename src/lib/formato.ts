// Formato de moneda, números y fechas. Centralizado: ninguna pantalla
// formatea a mano. Pesos argentinos: punto de miles, coma decimal.

const ZONA_POR_DEFECTO = "America/Argentina/Buenos_Aires";

/** $84.500 · $84.500,50 · -$1.200 */
export function formatearPesos(monto: number | string | null | undefined): string {
  if (monto === null || monto === undefined || monto === "") return "—";
  const n = typeof monto === "string" ? Number(monto) : monto;
  if (!Number.isFinite(n)) throw new Error(`Monto inválido: ${monto}`);
  const centavos = Math.round(Math.abs(n) * 100);
  const enteros = Math.floor(centavos / 100);
  const resto = centavos % 100;
  const conPuntos = enteros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}$${conPuntos}${resto ? `,${resto.toString().padStart(2, "0")}` : ""}`;
}

/** 1.234 · 1.234,5 */
export function formatearNumero(n: number, decimales = 0): string {
  const [ent, dec] = Math.abs(n).toFixed(decimales).split(".");
  const conPuntos = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}${conPuntos}${dec && Number(dec) !== 0 ? `,${dec}` : ""}`;
}

/** 14/11 en la zona del gimnasio */
export function fechaCorta(momento: Date | string, zona = ZONA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit" }).format(new Date(momento));
}

/**
 * Último día cubierto de un "hasta" exclusivo: hasta = 15/11 00:00 → "14/11".
 * Es lo que se muestra como "vence el …".
 */
export function ultimoDia(hasta: Date | string, zona = ZONA_POR_DEFECTO): string {
  return fechaCorta(new Date(new Date(hasta).getTime() - 1), zona);
}

/** "Buenas tardes" según la hora local del gimnasio */
export function saludo(momento: Date = new Date(), zona = ZONA_POR_DEFECTO): string {
  const hora = Number(new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", hourCycle: "h23" }).format(momento));
  if (hora >= 5 && hora < 13) return "Buen día";
  if (hora >= 13 && hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

/** Lunes 26/10 */
export function fechaLarga(momento: Date = new Date(), zona = ZONA_POR_DEFECTO): string {
  const dia = new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "long" }).format(momento);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fechaCorta(momento, zona)}`;
}
