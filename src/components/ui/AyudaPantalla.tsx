"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { marcarAyuda } from "@/app/ayuda-acciones";
import { claveDeRuta, textoAyuda } from "@/lib/ayuda";
import type { Rol } from "@/lib/panel/secciones";

export type EstadoAyudas = { vistas: string[]; apagadas: boolean };
/** Mi cuenta avisa por acá cuando la persona apaga las ayudas o pide verlas de nuevo. */
export const EVENTO_AYUDAS = "gymos:ayudas";

/**
 * VD-31 · El globo de ayuda de cada pantalla importante.
 * - La primera vez que se abre la pantalla sale un globo corto con "Entendido"; el "ya lo vio" se guarda
 *   en la base, por usuario (sigue entre dispositivos). La segunda vez no sale.
 * - El "?" queda fijo para volver a verlo cuando se quiera (aunque las ayudas estén apagadas).
 * - Va en el flujo de la página (nada flota encima): no tapa la ventana de Entrada ni la hoja Cobrar,
 *   no intercepta clics y no bloquea ninguna acción. Con reduced-motion no se mueve (globals.css).
 * - En una pantalla de error ([data-pantalla-error]) no sale ni el globo ni el "?".
 */
export function AyudaPantalla({ ambito, rol, inicial }: { ambito: "panel" | "app"; rol?: Rol; inicial: EstadoAyudas }) {
  const ruta = usePathname();
  const clave = claveDeRuta(ruta, ambito);
  const [vistas, setVistas] = useState(() => new Set(inicial.vistas));
  const [apagadas, setApagadas] = useState(inicial.apagadas);
  const [abierta, setAbierta] = useState(false);
  const [conError, setConError] = useState(false);
  const [lugar, setLugar] = useState<HTMLElement | null>(null);

  useEffect(() => { if (ambito === "app") setLugar(document.getElementById("ayuda-lugar")); }, [ambito]);

  useEffect(() => {
    const alCambiar = (e: Event) => {
      const d = (e as CustomEvent<{ apagadas?: boolean; reiniciar?: boolean }>).detail ?? {};
      if (typeof d.apagadas === "boolean") setApagadas(d.apagadas);
      if (d.reiniciar) setVistas(new Set());
    };
    window.addEventListener(EVENTO_AYUDAS, alCambiar);
    return () => window.removeEventListener(EVENTO_AYUDAS, alCambiar);
  }, []);

  // Al llegar a una pantalla: si es la primera vez, el globo se abre (un instante después, para no
  // salir sobre una pantalla de error, que se pinta en su lugar).
  const yaVista = !!clave && vistas.has(clave);
  useEffect(() => {
    setAbierta(false);
    setConError(false);
    if (!clave) return;
    const t = setTimeout(() => {
      const error = !!document.querySelector("[data-pantalla-error]");
      setConError(error);
      if (!error && !apagadas && !yaVista) setAbierta(true);
    }, 500);
    return () => clearTimeout(t);
    // Solo al cambiar de pantalla: marcar o apagar no tiene que reabrir ni cerrar nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const entendido = useCallback(() => {
    setAbierta(false);
    if (!clave) return;
    setVistas((v) => new Set(v).add(clave));
    if (!yaVista) void marcarAyuda(clave);   // si la base no responde, el globo igual se cierra: se vuelve a ver en la próxima visita
  }, [clave, yaVista]);

  const texto = clave ? textoAyuda(clave, rol) : null;
  if (!clave || !texto || conError) return null;

  const boton = (
    <button type="button" data-ayuda-boton onClick={() => (abierta ? entendido() : setAbierta(true))}
      aria-label={abierta ? "Cerrar la ayuda de esta pantalla" : "Ayuda de esta pantalla"} aria-expanded={abierta}
      className={ambito === "panel"
        ? "absolute right-[4.25rem] sm:right-[5.25rem] top-4 sm:top-8 z-10 grid place-items-center size-11 rounded-full border border-[var(--borde)] bg-[var(--tarjeta)] text-lg font-bold active:scale-95 transition"
        : "grid place-items-center size-9 rounded-full border border-[var(--borde)] bg-[var(--tarjeta)] text-base font-bold active:scale-95 transition"}>
      <span aria-hidden>?</span>
    </button>
  );
  return (
    <>
      {ambito === "app" ? (lugar ? createPortal(boton, lugar) : null) : boton}
      {abierta && (
        <section data-ayuda-globo={clave} aria-label="Ayuda de esta pantalla"
          className={`aparecer tarjeta p-4 mb-6 flex items-start gap-3 ${ambito === "panel" ? "pr-[7rem] sm:pr-[8.5rem]" : ""}`}>
          <span className="text-2xl flex-none" aria-hidden>{texto.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{texto.titulo}</p>
            <p className="texto-suave mt-0.5">{texto.texto}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" data-ayuda-entendido onClick={entendido} className="boton !min-h-11">Entendido</button>
              <Link href={ambito === "panel" ? "/panel/ayuda" : "/app/ayuda"} onClick={entendido} data-ayuda-mas className="underline texto-suave inline-flex items-center min-h-11 px-2">Más ayuda</Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
