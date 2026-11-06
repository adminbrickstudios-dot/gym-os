"use client";
// VD-28 · La memoria de una lista (la que nació en Socios con VD-15, ahora para todas): búsqueda/filtros en la
// URL y dónde estabas parado. Se guarda en sessionStorage (por pestaña, se va al cerrarla). Con `filtros`, al
// ENTRAR sin query se vuelve a los filtros de antes (Socios); si estás en la lista y tocás "Todos" o borrás un
// filtro, no se vuelve a poner: eso es lo que querías. Sin `filtros` solo se recuerda el scroll.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { guardarLista, leerLista, restaurarScroll } from "@/lib/panel/origen";

/** `ruta` es la pantalla (/panel/socios); `actual`, su query de ahora con "?" (o "" sin filtros). */
export function useMemoriaLista(ruta: string, actual: string, filtros = false) {
  const router = useRouter();
  const scrollPendiente = useRef<number | null>(null);
  const primera = useRef(true);
  const congelado = useRef(false);   // mientras se sale de la lista, el scroll a 0 de la pantalla nueva no se guarda
  const cancelar = useRef<() => void>(() => {});

  // Al entrar: sin query y con memoria → se vuelve a donde estabas; con la misma query → solo el scroll.
  useEffect(() => {
    if (!primera.current) return;
    primera.current = false;
    const g = leerLista(ruta);
    if (!g) return;
    if (filtros && actual === "" && g.q !== "") { scrollPendiente.current = g.y; router.replace(`${ruta}${g.q}`); return; }
    if (actual === g.q) scrollPendiente.current = g.y;
  }, [actual, filtros, ruta, router]);

  // Cada cambio de query se guarda; el scroll empieza de cero salvo que se esté restaurando.
  useEffect(() => {
    congelado.current = false;
    const g = leerLista(ruta);
    if (scrollPendiente.current !== null && g && g.q === actual) {
      const y = scrollPendiente.current; scrollPendiente.current = null;
      guardarLista(ruta, { q: actual, y, t: Date.now() });
      cancelar.current();
      cancelar.current = restaurarScroll(y);
      return;
    }
    if (scrollPendiente.current !== null) return;   // todavía va de camino a los filtros guardados
    guardarLista(ruta, { q: actual, y: 0, t: Date.now() });
  }, [actual, ruta]);

  // El scroll, cada tanto (no en cada pixel); y al tocar un link se guarda en el acto, antes de que la pantalla nueva suba a 0.
  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | null = null;
    let suelta: ReturnType<typeof setTimeout> | null = null;
    const alMover = () => {
      if (espera || congelado.current || scrollPendiente.current !== null) return;
      espera = setTimeout(() => { espera = null; if (!congelado.current) guardarLista(ruta, { q: actual, y: Math.round(window.scrollY), t: Date.now() }); }, 200);
    };
    const alTocar = (e: Event) => {
      if (!(e.target as Element | null)?.closest?.("a[href]") || scrollPendiente.current !== null) return;
      guardarLista(ruta, { q: actual, y: Math.round(window.scrollY), t: Date.now() });
      congelado.current = true;
      if (suelta) clearTimeout(suelta);
      suelta = setTimeout(() => { congelado.current = false; }, 1500);   // si el link no cambió de pantalla (una descarga), sigue guardando
    };
    window.addEventListener("scroll", alMover, { passive: true });
    document.addEventListener("click", alTocar, true);
    return () => {
      window.removeEventListener("scroll", alMover); document.removeEventListener("click", alTocar, true);
      if (espera) clearTimeout(espera); if (suelta) clearTimeout(suelta);
    };
  }, [actual, ruta]);
  useEffect(() => () => cancelar.current(), []);
}

/** No dibuja nada: es la memoria de una lista. */
export function MemoriaLista({ ruta, actual, filtros = false }: { ruta: string; actual: string; filtros?: boolean }) {
  useMemoriaLista(ruta, actual, filtros);
  return null;
}
