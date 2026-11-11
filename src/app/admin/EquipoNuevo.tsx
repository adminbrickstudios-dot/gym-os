"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { registrarEquipoBrik } from "./acciones";
import { Icono } from "@/components/ui/Icono";

/** F2.8: una vez por pestaña, anota desde qué equipo entra esta persona de BRIK; si es uno que no se había visto, avisa arriba y queda en el registro. */
export function EquipoNuevo() {
  const [nuevo, setNuevo] = useState(false);
  useEffect(() => {
    try { if (sessionStorage.getItem("brik_equipo_anotado")) return; sessionStorage.setItem("brik_equipo_anotado", "1"); } catch { /* sin almacenamiento: se anota igual */ }
    void registrarEquipoBrik().then((r) => setNuevo(r.nuevo));
  }, []);
  if (!nuevo) return null;
  return (
    <div role="status" data-equipo-nuevo className="mx-auto max-w-4xl px-4 sm:px-8 pt-4">
      <div className="tarjeta p-4 flex flex-wrap items-center gap-3">
        <Icono nombre="escudo" />
        <p className="flex-1 min-w-[14rem] text-sm">Entraste desde un equipo nuevo. Si no fuiste vos, cerrá las demás sesiones y cambiá tu contraseña.</p>
        <Link href="/admin/seguridad" className="boton">Ver mis sesiones</Link>
        <button type="button" className="boton texto-suave" onClick={() => setNuevo(false)}>Entendido</button>
      </div>
    </div>
  );
}
