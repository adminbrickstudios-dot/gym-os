// Horarios de apertura en palabras, a partir de las franjas de la base
// (privado.agenda). Funciones puras, con pruebas. Sirven en el servidor y
// en el navegador.

export type Franja = { dia: number; abre: string; cierra: string };
export type AgendaSede = { sede_id: string; sede: string; abierto: boolean; texto: string | null; franjas: Franja[] };
export type CierrePublico = { desde: string; hasta: string; motivo: string; sede: string | null };
export type Agenda = { sedes: AgendaSede[]; cierres: CierrePublico[] };

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const corto = (h: string) => h.replace(/^0(\d)/, "$1");

/** "07:00–22:00 · 16:00–20:00" para un día, o "Cerrado". */
function horasDelDia(franjas: Franja[], dia: number): string {
  const f = franjas.filter((x) => x.dia === dia).sort((a, b) => a.abre.localeCompare(b.abre));
  return f.length ? f.map((x) => `${corto(x.abre)} a ${corto(x.cierra)}`).join(" y ") : "Cerrado";
}

/**
 * Agrupa días seguidos con el mismo horario:
 * [{dias: "Lunes a viernes", horas: "7:00 a 22:00"}, {dias: "Sábado", horas: "9:00 a 13:00 y 16:00 a 20:00"}, {dias: "Domingo", horas: "Cerrado"}]
 */
export function resumirHorarios(franjas: Franja[]): { dias: string; horas: string }[] {
  if (!franjas.length) return [];
  const filas: { desde: number; hasta: number; horas: string }[] = [];
  for (let d = 1; d <= 7; d++) {
    const horas = horasDelDia(franjas, d);
    const ultima = filas[filas.length - 1];
    if (ultima && ultima.horas === horas && ultima.hasta === d - 1) ultima.hasta = d;
    else filas.push({ desde: d, hasta: d, horas });
  }
  return filas.map((f) => ({
    dias: f.desde === f.hasta ? DIAS[f.desde - 1]
      : f.hasta === f.desde + 1 ? `${DIAS[f.desde - 1]} y ${DIAS[f.hasta - 1].toLowerCase()}`
      : `${DIAS[f.desde - 1]} a ${DIAS[f.hasta - 1].toLowerCase()}`,
    horas: f.horas,
  }));
}

/** "lun 16/11" o "del lun 16/11 al vie 20/11" (fechas AAAA-MM-DD del gimnasio). */
export function textoCierre(c: { desde: string; hasta: string }): string {
  const f = (s: string) => {
    const [a, m, d] = s.split("-").map(Number);
    const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
    return `${["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][dia]} ${d}/${m}`;
  };
  return c.desde === c.hasta ? f(c.desde) : `del ${f(c.desde)} al ${f(c.hasta)}`;
}
