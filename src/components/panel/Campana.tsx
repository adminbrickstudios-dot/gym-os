"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { contarCampana } from "@/app/panel/campana/acciones";
import { Icono } from "@/components/ui/Icono";
import { EVENTO_PENDIENTES } from "@/lib/panel/pendientes";

/** AVI-5: el arriba a la derecha. El número se pide después de pintar: no frena la pantalla. */
export function Campana() {
  const ruta = usePathname();
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    const pedir = () => { void contarCampana().then((x) => { if (vivo) setN(x); }); };
    pedir();
    // Cuando algo se resuelve sin cambiar de pantalla (“Marcar todo como leído”), el número se vuelve a pedir.
    window.addEventListener(EVENTO_PENDIENTES, pedir);
    // FLUIDEZ regla 14: con la pantalla quieta, se vuelve a pedir cada 60 s (solo con la pestaña a la vista) y al volver a ella.
    const cada = setInterval(() => { if (document.visibilityState === "visible") pedir(); }, 60_000);
    const alVolver = () => { if (document.visibilityState === "visible") pedir(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { vivo = false; clearInterval(cada); document.removeEventListener("visibilitychange", alVolver); window.removeEventListener(EVENTO_PENDIENTES, pedir); };
  }, [ruta]);
  const activa = ruta === "/panel/campana";
  return (
    <Link href="/panel/campana" aria-label={n ? `Novedades: ${n} sin ver` : "Novedades"} data-campana={n ?? ""}
      className={`relative grid place-items-center size-11 rounded-full border border-[var(--borde)] bg-[var(--tarjeta)] text-xl active:scale-95 transition ${activa ? "ring-2 ring-[var(--acento)]" : ""}`}>
      <span aria-hidden><Icono nombre="campana" /></span>
      {!!n && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-xs font-bold grid place-items-center" style={{ background: "var(--acento)", color: "var(--sobre-acento)" }} aria-hidden>
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}
