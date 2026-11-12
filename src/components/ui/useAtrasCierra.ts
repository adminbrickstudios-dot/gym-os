"use client";
import { useEffect, useRef } from "react";

/**
 * FLUIDEZ reglas 5 y 6: el "atrás" del celular (y del navegador) cierra lo que está abierto en vez de sacar de la pantalla.
 * Mientras `abierto`, deja una entrada más en el historial; al tocar "atrás" se consume esa entrada y se llama a `cerrar`.
 * Si se cierra de otra forma (la X, Esc, tocar afuera), la entrada sobrante se saca sola. Si se navegó a otra pantalla, no se toca nada.
 */
export function useAtrasCierra(abierto: boolean, cerrar: () => void) {
  const alCerrar = useRef(cerrar);
  useEffect(() => { alCerrar.current = cerrar; });
  useEffect(() => {
    if (!abierto) return;
    const marca = `${Date.now()}-${Math.random()}`;
    let porAtras = false;
    window.history.pushState({ ...(window.history.state ?? {}), __hoja: marca }, "", window.location.href);
    const alAtras = () => { porAtras = true; alCerrar.current(); };
    window.addEventListener("popstate", alAtras);
    return () => {
      window.removeEventListener("popstate", alAtras);
      if (!porAtras && window.history.state?.__hoja === marca) window.history.back();
    };
  }, [abierto]);
}
