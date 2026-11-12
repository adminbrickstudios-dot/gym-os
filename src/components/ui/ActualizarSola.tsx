"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * FLUIDEZ regla 14 (en vivo donde importa): vuelve a pedir la pantalla cada `cadaSegundos`, solo con la pestaña a la vista,
 * y apenas se vuelve a ella. Lo que se está escribiendo en la pantalla no se pierde (refresh no reinicia el estado del navegador).
 * Sin ruido: no dibuja nada. Es el "en vivo" simple para listas que cambian por lo que pasa en otra compu o en el celular del socio.
 */
export function ActualizarSola({ cadaSegundos = 30 }: { cadaSegundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const pedir = () => { if (document.visibilityState === "visible" && navigator.onLine) router.refresh(); };
    const cada = setInterval(pedir, cadaSegundos * 1000);
    document.addEventListener("visibilitychange", pedir);
    return () => { clearInterval(cada); document.removeEventListener("visibilitychange", pedir); };
  }, [router, cadaSegundos]);
  return null;
}
