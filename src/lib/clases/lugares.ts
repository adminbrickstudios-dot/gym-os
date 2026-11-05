/** COM-12: el mapa de lugares de una clase, como lo devuelve lugares_clase. */
export type OcupadoEquipo = { lugar: number; socio_id: string; nombre: string };
export type MapaLugares<O = number> = { etiqueta: string; cantidad: number; fuera_servicio: number[]; ocupados: O[]; mio: number | null; reserva_id: string | null };

/** "1, 4-6" → [1, 4, 5, 6]. Lo que no es número se ignora; la base valida el rango. */
export function leerNumeros(texto: string): number[] {
  const out = new Set<number>();
  for (const parte of texto.split(/[,\s]+/).filter(Boolean)) {
    const m = parte.match(/^(\d{1,3})(?:-(\d{1,3}))?$/);
    if (!m) continue;
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b) && n <= 200; n++) out.add(n);
  }
  return [...out].sort((x, y) => x - y);
}
