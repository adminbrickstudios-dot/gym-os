"use client";
// E6 · Recepción sin internet. Si se corta la conexión, la Entrada lo dice en rojo y nada parece andar cuando no anda:
// "Sin internet: anotá en papel". La cola offline real (que se sincronice al volver) es la función nueva N-B; acá NO se
// inventa un veredicto: sin conexión no hay estado_acceso, y lo único honesto es decirlo.
//
// Cómo se sabe: el navegador avisa (online/offline), cualquier pedido de la Entrada que falla por la red lo avisa
// (avisarFalloRed) y, mientras la pestaña está a la vista, un HEAD a /favicon.ico (no pasa por el proxy ni por la base)
// confirma cada 15 s (cada 4 s si estamos sin internet, para volver apenas vuelva).
import { useEffect, useState } from "react";
import { Icono } from "@/components/ui/Icono";

const EVENTO_FALLO_RED = "gymos:fallo-red";
export const TEXTO_SIN_INTERNET = "Sin internet: anotá en papel";

/** Un pedido de la Entrada falló por la red: se confirma enseguida. */
export const avisarFalloRed = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_FALLO_RED)); };

/** ¿El error de un pedido es de la red (y no un error de la base)? */
export const esErrorDeRed = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return (typeof navigator !== "undefined" && navigator.onLine === false) || /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(m);
};

async function hayRed(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 4000);
    const r = await fetch(`/favicon.ico?_=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: c.signal });
    clearTimeout(t);
    return r.status > 0;
  } catch { return false; }
}

/** true mientras la compu no tiene internet. */
export function useSinInternet(): boolean {
  const [sin, setSin] = useState(false);
  useEffect(() => {
    let vivo = true;
    const confirmar = async () => { const ok = await hayRed(); if (vivo) setSin(!ok); };
    const caer = () => setSin(true);
    if (navigator.onLine === false) setSin(true);
    window.addEventListener("offline", caer);
    window.addEventListener("online", confirmar);
    window.addEventListener(EVENTO_FALLO_RED, confirmar);
    return () => { vivo = false; window.removeEventListener("offline", caer); window.removeEventListener("online", confirmar); window.removeEventListener(EVENTO_FALLO_RED, confirmar); };
  }, []);
  useEffect(() => {
    let vivo = true;
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const ok = await hayRed();
      if (vivo) setSin(!ok);
    }, sin ? 4000 : 15000);
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
