// SEG-5: búsqueda en la copia de la entrada (la copia la calcula la base;
// acá solo se busca y se decide si la copia todavía sirve).
import type { CopiaEntrada } from "@/app/panel/entrada/acciones";

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Por nombre (cualquier parte, sin acentos), número de socio exacto o DNI que empieza así. */
export function buscarEnCopia(copia: CopiaEntrada | null, texto: string, max = 8): CopiaEntrada["socios"] {
  const q = sinAcentos(texto.trim());
  if (!copia || q.length < 2) return [];
  const soloNum = /^\d+$/.test(q);
  const palabras = q.split(/\s+/);
  return copia.socios.filter((s) => soloNum
    ? String(s.num) === q || (s.dni ?? "").startsWith(q)
    : palabras.every((p) => sinAcentos(s.n).includes(p))).slice(0, max);
}

/** La copia sirve hasta la medianoche del gimnasio del día en que se bajó (después cambian los vencimientos). */
export function copiaVigente(copia: CopiaEntrada | null, ahora = new Date()): boolean {
  return !!copia && new Date(copia.valida_hasta) > ahora;
}
