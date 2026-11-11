// FA-14 · Lo que devuelve resumen_app_socio (la base calcula todo: acá solo se dan nombres y se escribe en castellano).

export type Insignia = { clave: string; titulo: string; emoji: string; meta: number; avance: number; lograda: boolean };
export type ResumenApp = {
  recomendacion: { regla: string; dias: number; clase: { nombre: string; hora: string } | null; texto: string } | null;
  insignias: Insignia[];
  anio: { anio: number; visitas: number; mes_top: number | null; dia_top: number | null; clases: number; rutina_dias: number; mejor_racha_semanas: number };
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export const nombreMes = (m: number | null) => (m && m >= 1 && m <= 12 ? MESES[m - 1] : null);
/** 1 = lunes … 7 = domingo (isodow). */
export const nombreDia = (d: number | null) => (d && d >= 1 && d <= 7 ? DIAS[d - 1] : null);

/** "Tu año": frases cortas, solo con lo que hay (un año sin visitas no inventa nada). */
export function frasesDelAnio(a: ResumenApp["anio"]): string[] {
  const f: string[] = [];
  if (a.visitas > 0) f.push(`Viniste ${a.visitas} ${a.visitas === 1 ? "vez" : "veces"} en ${a.anio}.`);
  const mes = nombreMes(a.mes_top);
  if (mes) f.push(`Tu mes más fuerte fue ${mes}.`);
  const dia = nombreDia(a.dia_top);
  if (dia) f.push(`Tu día favorito para entrenar es el ${dia}.`);
  if (a.clases > 0) f.push(`Hiciste ${a.clases} ${a.clases === 1 ? "clase" : "clases"}.`);
  if (a.rutina_dias > 0) f.push(`Completaste ${a.rutina_dias} ${a.rutina_dias === 1 ? "día" : "días"} de tu rutina.`);
  if (a.mejor_racha_semanas >= 2) f.push(`Tu mejor racha: ${a.mejor_racha_semanas} semanas seguidas.`);
  return f;
}
