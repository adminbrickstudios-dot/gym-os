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

/** "12345678" → "12.345.678" (solo para mostrar; en la base el DNI va sin puntos). */
export function formatearDni(dni: string | number | null | undefined): string {
  return String(dni ?? "").replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Lunes 26/10 */
export function fechaLarga(momento: Date = new Date(), zona = ZONA_POR_DEFECTO): string {
  const dia = new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "long" }).format(momento);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fechaCorta(momento, zona)}`;
}

const DIA_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
/** El día calendario (aaaa-mm-dd) de un momento, en la zona del gimnasio (nunca la de la compu). */
function diaEn(momento: Date, zona: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(momento);
}

/**
 * "hoy", "ayer" o "lun 12/11", siempre en la hora del gimnasio. `ahora` se pasa en los tests (nunca dependen de now()).
 * Un momento de más de once meses se muestra con el año ("lun 12/11/25") para que no se confunda con el de este año.
 */
export function fechaHumana(momento: Date | string, zona = ZONA_POR_DEFECTO, ahora: Date = new Date()): string {
  const m = new Date(momento);
  const dia = diaEn(m, zona);
  if (dia === diaEn(ahora, zona)) return "hoy";
  if (dia === diaEn(new Date(ahora.getTime() - 86_400_000), zona)) return "ayer";
  const diaSemana = DIA_CORTO[new Date(`${dia}T12:00:00Z`).getUTCDay()];
  const [a, mes, d] = dia.split("-");
  const lejos = Math.abs(ahora.getTime() - m.getTime()) > 330 * 86_400_000;
  return `${diaSemana} ${d}/${mes}${lejos ? `/${a.slice(2)}` : ""}`;
}

/** "hoy 19:42", "ayer 08:05", "lun 12/11 19:42": la fecha humana y la hora del gimnasio. */
export function fechaHoraHumana(momento: Date | string, zona = ZONA_POR_DEFECTO, ahora: Date = new Date()): string {
  const hora = new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(momento));
  return `${fechaHumana(momento, zona, ahora)} ${hora}`;
}

/**
 * Un celular argentino para mostrar: "+54 9 11 2345-6789". Acepta lo que venga (con +54, con 9, con 0, con 15, con guiones).
 * Si no se reconoce como un celular de 10 cifras, se devuelve tal cual (nunca se inventa un número).
 */
export function formatearCelular(telefono: string | null | undefined): string {
  const crudo = String(telefono ?? "").trim();
  let d = crudo.replace(/\D/g, "");
  if (d.startsWith("549")) d = d.slice(3);
  else if (d.startsWith("54")) d = d.slice(2);
  else d = d.replace(/^0/, "");
  if (d.length === 12 && /^\d{2,4}15/.test(d)) d = d.replace(/15/, "");   // "11 15 2345 6789"
  if (d.length !== 10) return crudo;
  const area = d.startsWith("11") ? 2 : 3;
  const resto = d.slice(area);
  const corte = resto.length - 4;
  return `+54 9 ${d.slice(0, area)} ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}
