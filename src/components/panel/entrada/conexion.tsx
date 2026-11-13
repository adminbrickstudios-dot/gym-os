"use client";
// E6 · Recepción sin internet. Si se corta la conexión, la Entrada lo dice en rojo y nada parece andar cuando no anda:
// "Sin internet: anotá en papel". La cola offline real (que se sincronice al volver) es la función nueva N-B; acá NO se
// inventa un veredicto: sin conexión no hay estado_acceso, y lo único honesto es decirlo.
//
// Cómo se sabe, sin pedidos de prueba de más (con 20 gimnasios, cada pedido cuenta):
//   · el navegador avisa (offline / online);
//   · un pedido de la Entrada que falla por la red lo avisa (avisarFalloRed): cubre el caso "hay wifi pero el router no tiene salida";
//   · el siguiente pedido que sale bien lo borra (avisarRedOk), y la barrita sigue intentando aunque la franja esté puesta.
import { useEffect, useState } from "react";
import { Icono } from "@/components/ui/Icono";

const EVENTO_FALLO_RED = "gymos:fallo-red";
const EVENTO_RED_OK = "gymos:red-ok";
export const TEXTO_SIN_INTERNET = "Sin internet: anotá en papel";

/** Un pedido de la Entrada falló por la red. */
export const avisarFalloRed = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_FALLO_RED)); };
/** Un pedido de la Entrada salió bien: hay internet. */
export const avisarRedOk = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_RED_OK)); };

/** ¿El error de un pedido es de la red (y no un error de la base)? */
export const esErrorDeRed = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return (typeof navigator !== "undefined" && navigator.onLine === false) || /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(m);
};

/** true mientras la compu no tiene internet. */
export function useSinInternet(): boolean {
  const [sin, setSin] = useState(false);
  useEffect(() => {
    const caer = () => setSin(true);
    const volver = () => setSin(false);
    if (navigator.onLine === false) setSin(true);
    window.addEventListener("offline", caer);
    window.addEventListener("online", volver);
    window.addEventListener(EVENTO_FALLO_RED, caer);
    window.addEventListener(EVENTO_RED_OK, volver);
    return () => {
      window.removeEventListener("offline", caer); window.removeEventListener("online", volver);
      window.removeEventListener(EVENTO_FALLO_RED, caer); window.removeEventListener(EVENTO_RED_OK, volver);
    };
  }, []);
  // Ya en rojo: cada 4 s se mira si volvió (el navegador no siempre avisa "online"); solo corre mientras no hay internet.
  useEffect(() => {
    if (!sin) return;
    let vivo = true;
    const id = setInterval(async () => {
      if (navigator.onLine === false || document.visibilityState !== "visible") return;
      try {
        const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000);
        const r = await fetch(`/api/version?_=${Date.now()}`, { cache: "no-store", signal: c.signal });
        clearTimeout(t);
        if (vivo && r.status > 0) setSin(false);
      } catch { /* sigue sin internet */ }
    }, 4000);
    return () => { vivo = false; clearInterval(id); };
  }, [sin]);
  return sin;
}

/** La franja roja de arriba, en todo el panel (también en la pantalla de Entrada), mientras no hay internet. */
export function SinInternet({ sin }: { sin: boolean }) {
  useEffect(() => {
    document.documentElement.dataset.sinInternet = sin ? "si" : "no";
    return () => { delete document.documentElement.dataset.sinInternet; };
  }, [sin]);
  if (!sin) return null;
  return (
    <div role="alert" data-sin-internet className="fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-2 px-4 py-3 text-center font-bold text-lg bg-[color-mix(in_oklab,var(--rojo),black_38%)] text-white [box-shadow:var(--sombra-flota)]">
      <Icono nombre="alerta" /> {TEXTO_SIN_INTERNET}
      <span className="font-normal text-base opacity-90 hidden sm:inline">· lo que anotes acá no se guarda hasta que vuelva la conexión</span>
    </div>
  );
}
