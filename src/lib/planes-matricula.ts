import { leerMonto } from "@/lib/formato";

/** Q1 (D70) · La matrícula de un plan nuevo se valida ANTES de crear el plan: si está mal, no queda un plan a medias con su precio. */
export function validarMatriculaNueva(tipo: string, texto: string): { monto: number | null; error?: string } {
  const t = texto.trim();
  if (tipo !== "membresia" || !t) return { monto: null };
  const m = leerMonto(t);
  if (Number.isNaN(m)) return { monto: null, error: "No entiendo la matrícula: escribila como 84.500 o 84500,50" };
  if (m < 0) return { monto: null, error: "La matrícula no puede ser negativa" };
  return { monto: m };
}
