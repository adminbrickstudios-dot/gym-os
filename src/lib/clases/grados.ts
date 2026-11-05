/** COM-13: los grados (cinturones) por actividad, como los devuelve la base. */
export type GradoRef = { grado_id: string; nombre: string; color: string | null };
export type Progreso = {
  actual: (GradoRef & { otorgado_en: string }) | null;
  proximo: (GradoRef & { clases_minimas: number; meses_minimos: number }) | null;
  desde: string | null; clases: number; meses: number; listo: boolean;
};
export type GradoPanel = { grado_id: string; orden: number; nombre: string; color: string | null; clases_minimas: number; meses_minimos: number; socios: number };
export type GradosPanel = {
  actividades: { actividad_id: string; nombre: string; emoji: string | null; grados: GradoPanel[] }[];
  listos: ({ socio_id: string; nombre: string; actividad: string; actividad_id: string } & Progreso)[];
};
export type GradosSocio = ({ actividad_id: string; actividad: string; emoji: string | null; grados: { grado_id: string; nombre: string; orden: number }[];
  historial: { id: string; nombre: string; color: string | null; otorgado_en: string; por: string | null }[] } & Progreso)[];

/** "12 de 20 clases · 3 de 4 meses" (lo que falta para el próximo grado). */
export function textoRequisitos(p: Progreso): string {
  if (!p.proximo) return "Tiene el grado más alto";
  const partes: string[] = [];
  if (p.proximo.clases_minimas > 0) partes.push(`${Math.min(p.clases, p.proximo.clases_minimas)} de ${p.proximo.clases_minimas} clases`);
  if (p.proximo.meses_minimos > 0) partes.push(`${Math.min(p.meses, p.proximo.meses_minimos)} de ${p.proximo.meses_minimos} ${p.proximo.meses_minimos === 1 ? "mes" : "meses"}`);
  return partes.length ? partes.join(" · ") : "Sin requisitos";
}
