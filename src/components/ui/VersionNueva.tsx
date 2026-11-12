"use client";
import { useEffect, useRef, useState } from "react";
import { Icono } from "@/components/ui/Icono";

const CADA_MS = 5 * 60_000;

/**
 * "Hay una versión nueva" (Z7): cuando se publica algo mientras la pantalla está abierta, avisa y deja recargar cuando la persona quiere.
 * No recarga sola: lo escrito sin guardar sigue ahí (si hay cambios, el navegador pregunta antes de irse, y los formularios largos guardan borrador).
 * En local o sin versión publicada (`null`) no avisa nunca.
 */
export function VersionNueva() {
  const inicial = useRef<string | null>(null);
  const [nueva, setNueva] = useState(false);
  useEffect(() => {
    let vivo = true;
    const mirar = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const { version } = (await r.json()) as { version: string | null };
        if (!vivo || !version) return;
        if (inicial.current === null) inicial.current = version;
        else if (version !== inicial.current) setNueva(true);
      } catch { /* sin conexión: ya lo dice SinConexion */ }
    };
    void mirar();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void mirar(); }, CADA_MS);
    const alVolver = () => { if (document.visibilityState === "visible") void mirar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { vivo = false; clearInterval(timer); document.removeEventListener("visibilitychange", alVolver); };
  }, []);
  if (!nueva) return null;
  return (
    <p role="status" className="mensaje mensaje-info mb-6 pr-14 flex flex-wrap items-center gap-3" data-version-nueva>
      <Icono nombre="repetir" /> <span><strong>Hay una versión nueva.</strong> Recargá cuando termines lo que estás haciendo: si tenés algo sin guardar, el navegador te pregunta antes de irse.</span>
      <button type="button" className="boton !min-h-11" onClick={() => window.location.reload()}>Recargar</button>
    </p>
  );
}
