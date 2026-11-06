"use client";
// VD-15 · La lista de Socios se acuerda de cómo la dejaste: búsqueda, filtros y dónde estabas parado.
// Se guarda en sessionStorage (por pestaña del navegador, se va al cerrarla). Se restaura solo al
// ENTRAR a Socios sin filtros (volver de una ficha, del menú, de Cobrar); si estás en la lista y
// tocás "Todos" o borrás un filtro, no se vuelve a poner: eso es lo que querías.
// VD-28 hará la memoria de la navegación global; esto es solo la de Socios.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export const CLAVE_MEMORIA_SOCIOS = "gymos.socios.lista";
const VIGENCIA_MS = 8 * 60 * 60 * 1000;
type Guardado = { q: string; y: number; t: number };

function leer(): Guardado | null {
  try {
    const g = JSON.parse(sessionStorage.getItem(CLAVE_MEMORIA_SOCIOS) ?? "null") as Guardado | null;
    return g && typeof g.q === "string" && Date.now() - g.t < VIGENCIA_MS ? g : null;
  } catch { return null; }
}
function guardar(g: Guardado) {
  try { sessionStorage.setItem(CLAVE_MEMORIA_SOCIOS, JSON.stringify(g)); } catch { /* sin almacenamiento: la lista anda igual, sin memoria */ }
}

/** `actual` es la query de ahora, con "?" (o "" sin filtros). No dibuja nada. */
export function MemoriaSocios({ actual }: { actual: string }) {
  const router = useRouter();
  const scrollPendiente = useRef<number | null>(null);
  const primera = useRef(true);

  // Al entrar: sin filtros y con memoria → se vuelve a donde estabas; con los mismos filtros → solo el scroll.
  useEffect(() => {
    if (!primera.current) return;
    primera.current = false;
    const g = leer();
    if (!g) return;
    if (actual === "" && g.q !== "") { scrollPendiente.current = g.y; router.replace(`/panel/socios${g.q}`); return; }
    if (actual === g.q) scrollPendiente.current = g.y;
  }, [actual, router]);

  // Cada cambio de filtros se guarda; el scroll empieza de cero salvo que se esté restaurando.
  useEffect(() => {
    const g = leer();
    if (scrollPendiente.current !== null && g && g.q === actual) {
      const y = scrollPendiente.current; scrollPendiente.current = null;
      guardar({ q: actual, y, t: Date.now() });
      if (y > 0) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
      return;
    }
    if (scrollPendiente.current !== null) return;   // todavía va de camino a los filtros guardados
    guardar({ q: actual, y: 0, t: Date.now() });
  }, [actual]);

  // El scroll, cada tanto (no en cada pixel).
  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | null = null;
    const alMover = () => {
      if (espera || scrollPendiente.current !== null) return;
      espera = setTimeout(() => { espera = null; guardar({ q: actual, y: Math.round(window.scrollY), t: Date.now() }); }, 200);
    };
    window.addEventListener("scroll", alMover, { passive: true });
    return () => { window.removeEventListener("scroll", alMover); if (espera) clearTimeout(espera); };
  }, [actual]);

  return null;
}
