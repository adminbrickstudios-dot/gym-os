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

/**
 * Lee un monto escrito a mano: "84.500,50", "84500,5", "$ 84.500", "1500.50", "1500".
 * Coma = decimales y punto = miles, salvo un único punto seguido de 1 o 2 cifras al
 * final ("1500.50"), que es decimal. Lo que no se entiende da NaN, nunca un número
 * cualquiera: "1500.50" no puede volverse 150.050.
 */
export function leerMonto(texto: string | null | undefined): number {
  const t = String(texto ?? "").replace(/[$\s]/g, "");
  if (!t) return NaN;
  if (t.includes(",")) {
    if (!/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^-?\d+(,\d{1,2})?$/.test(t)) return NaN;
    return Number(t.replace(/\./g, "").replace(",", "."));
  }
  if (/^-?\d+\.\d{1,2}$/.test(t)) return Number(t);
  if (/^-?\d{1,3}(\.\d{3})+$|^-?\d+$/.test(t)) return Number(t.replace(/\./g, ""));
  return NaN;
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
