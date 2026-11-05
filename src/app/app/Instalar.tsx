"use client";
import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * APP-1: la app del gimnasio en la pantalla de inicio. En Android/Chrome, el
 * botón la instala; en iPhone se explica cómo (Safari no tiene botón). Ya
 * instalada, o si la cerró, no se muestra.
 */
export function Instalar({ gimnasio = "tu gimnasio" }: { gimnasio?: string }) {
  const [modo, setModo] = useState<"no" | "boton" | "iphone">("no");
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  useEffect(() => {
    const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    let cerrado = false;
    try { cerrado = localStorage.getItem("gymos_instalar_cerrado") === "1"; } catch { /* sin almacenamiento: se muestra */ }
    if (instalada || cerrado) return;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) { setModo("iphone"); return; }
    const alPedir = (e: Event) => { e.preventDefault(); setEvento(e as EventoInstalar); setModo("boton"); };
    window.addEventListener("beforeinstallprompt", alPedir);
    return () => window.removeEventListener("beforeinstallprompt", alPedir);
  }, []);
  if (modo === "no") return null;
  const cerrar = () => { try { localStorage.setItem("gymos_instalar_cerrado", "1"); } catch { /* nada */ } setModo("no"); };
  return (
    <section className="tarjeta p-4 flex flex-wrap items-center gap-3" data-instalar={modo}>
      <span className="text-2xl" aria-hidden>📲</span>
      <p className="flex-1 min-w-48">
        {modo === "iphone"
          ? <>Tené a {gimnasio} en tu pantalla de inicio: tocá <b>Compartir</b> y después <b>Agregar a inicio</b>.</>
          : <>Tené a {gimnasio} en tu pantalla de inicio, como una app.</>}
      </p>
      {modo === "boton" && evento && (
        <button type="button" className="boton" onClick={async () => { await evento.prompt(); await evento.userChoice; setModo("no"); }}>Instalar</button>
      )}
      <button type="button" className="boton-texto texto-suave" onClick={cerrar} aria-label="No mostrar más">Ahora no</button>
    </section>
  );
}
