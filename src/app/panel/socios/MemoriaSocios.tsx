"use client";
// VD-15 · La lista de Socios se acuerda de cómo la dejaste: búsqueda, filtros y dónde estabas parado.
// VD-28 generalizó la mecánica en useMemoriaLista (components/panel/MemoriaLista.tsx), que usan todas las
// listas; Socios la pide con `filtros` (al entrar sin filtros, vuelve a los de antes).
import { MemoriaLista } from "@/components/panel/MemoriaLista";
import { claveLista } from "@/lib/panel/origen";

export const CLAVE_MEMORIA_SOCIOS = claveLista("/panel/socios");

/** `actual` es la query de ahora, con "?" (o "" sin filtros). No dibuja nada. */
export function MemoriaSocios({ actual }: { actual: string }) {
  return <MemoriaLista ruta="/panel/socios" actual={actual} filtros />;
}
