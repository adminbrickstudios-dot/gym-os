// VD-53 · Formato de las horas fichadas. Nada se calcula acá: los minutos, el estado y los totales los entrega la base.
export type Turno = {
  id: string; dia: string; entrada: string; salida: string | null;
  estado: "cerrado" | "abierto" | "sin_salida" | "anulado";
  minutos: number; corregido: boolean; corregido_motivo: string | null; anulado_motivo: string | null; sede: string | null;
};
export type HorasMes = { mes: string; turnos: Turno[]; minutos: number; sin_salida: number };

/** 270 → "4 h 30 min"; 480 → "8 h"; 45 → "45 min". */
export function textoMinutos(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")} min`;
}

export const horaLocal = (iso: string, zona: string) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

/** Un instante → "2026-11-05T14:30" en la hora del gimnasio (para el campo de fecha y hora). */
export function aCampoLocal(iso: string, zona: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}

export const ETIQUETA_ESTADO: Record<Turno["estado"], string> = {
  cerrado: "", abierto: "en turno", sin_salida: "sin salida: no suma", anulado: "anulado",
};
