"use client";
import { useEffect } from "react";

export const TEXTO_CAMBIOS_SIN_GUARDAR = "Tenés cambios sin guardar. Si salís ahora se pierden. ¿Salir igual?";

/**
 * FLUIDEZ regla 7: nada se pierde sin avisar. Con `sucio`, cerrar la pestaña o recargar pregunta (`beforeunload`)
 * y también pregunta tocar cualquier link de la misma página web (el menú, Volver, una ficha): el link no navega hasta que se confirma.
 */
export function useCambiosSinGuardar(sucio: boolean) {
  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const alTocar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;   // el mismo lugar (una ancla, otra pestaña de la pantalla)
      if (!window.confirm(TEXTO_CAMBIOS_SIN_GUARDAR)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", avisar);
    document.addEventListener("click", alTocar, true);
    return () => { window.removeEventListener("beforeunload", avisar); document.removeEventListener("click", alTocar, true); };
  }, [sucio]);
}
