"use client";
import { useCallback, useEffect, useRef } from "react";

/**
 * FLUIDEZ reglas 5 y 6: el "atrás" del celular (y del navegador) cierra lo que está abierto en vez de sacar de la pantalla.
 *
 * Mientras `abierto`, deja una entrada más en el historial (con una marca). Al tocar "atrás" el navegador consume esa
 * entrada y se llama a `cerrar`. Devuelve `soltar()`: se llama cuando la persona cierra con la X, Esc o tocando afuera, para
 * sacar esa entrada de más (si no, el primer "atrás" después de cerrar no haría nada).
 *
 * Nunca saca la entrada por su cuenta al desmontarse: si se cerró porque se está yendo a otra pantalla, sacarla
 * competiría con esa navegación. Quien navega desde adentro usa `router.replace` (ver Buscador) y la entrada se reemplaza.
 * Con `activo` falso no hace nada (la hoja de Cobrar y la Entrada manejan su propio cierre).
 */
export function useAtrasCierra(abierto: boolean, cerrar: () => void, activo = true) {
  const alCerrar = useRef(cerrar);
  const marca = useRef<string | null>(null);
  useEffect(() => { alCerrar.current = cerrar; });
  useEffect(() => {
    if (!abierto || !activo) return;
    // Si la entrada de una apertura anterior sigue siendo la actual, se reusa: no se apilan.
    if (!(marca.current && window.history.state?.__hoja === marca.current)) {
      marca.current = `${Date.now()}-${Math.random()}`;
      window.history.pushState({ ...(window.history.state ?? {}), __hoja: marca.current }, "", window.location.href);
    }
    const alAtras = () => { if (!marca.current) return; marca.current = null; alCerrar.current(); };
    window.addEventListener("popstate", alAtras);
    return () => window.removeEventListener("popstate", alAtras);
  }, [abierto, activo]);
  return useCallback(() => {
    const m = marca.current;
    if (m && window.history.state?.__hoja === m) { marca.current = null; window.history.back(); }
  }, []);
}
