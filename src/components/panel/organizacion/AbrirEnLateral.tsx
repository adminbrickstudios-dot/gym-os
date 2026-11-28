"use client";
// Pase 2.0 · organización (26/11 · DISENO.md regla 1, "Ver sin entrar"): un socio en CUALQUIER lista (Socios, Para hacer hoy, Últimas entradas,
// Retención, Clases, Caja, la búsqueda) abre el panel lateral en vez de ir a la ficha. Un solo lugar: se intercepta el toque común en un link a
// /panel/socios/<id> (la ficha) y se abre el panel lateral, que ya existe. La ficha completa queda para editar: con Ctrl/Cmd, la ruedita, un link
// marcado data-ficha-completa o una sub-pantalla de la ficha (editar, reglamento), se navega como siempre. Solo con la llave prendida.
import { useEffect } from "react";
import { EVENTO_ABRIR_PANEL_SOCIO } from "../PanelSocioLateral";

const FICHA = /^\/panel\/socios\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export function AbrirEnLateral() {
  useEffect(() => {
    const alTocar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (document.documentElement.dataset.panelSocioMontado !== "si") return;   // sin panel lateral (un rol que no lo usa), la ficha de siempre
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("data-ficha-completa") || a.closest("[data-panel-socio-lateral]")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.search) return;   // ?pestana=pagos y otras vistas de la ficha: la ficha
      const m = FICHA.exec(url.pathname);
      if (!m) return;
      e.preventDefault();
      window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_PANEL_SOCIO, { detail: { socioId: m[1] } }));
    };
    document.addEventListener("click", alTocar, true);
    return () => document.removeEventListener("click", alTocar, true);
  }, []);
  return null;
}
