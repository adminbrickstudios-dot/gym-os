"use client";
import { useEffect, useState } from "react";
import { Icono } from "@/components/ui/Icono";

/**
 * "Se cortó internet" (10-DIA-A-DIA): la pantalla lo dice en vez de quedarse
 * esperando. Mientras dure, lo que se toque puede no guardarse: la recepción
 * anota en papel y lo carga al volver (la Entrada sin internet es SEG-5).
 */
export function SinConexion({ quien = "equipo" }: { quien?: "equipo" | "socio" }) {
  const [sin, setSin] = useState(false);
  useEffect(() => {
    const actualizar = () => setSin(!navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => { window.removeEventListener("online", actualizar); window.removeEventListener("offline", actualizar); };
  }, []);
  if (!sin) return null;
  return (
    <p role="alert" className="mensaje mensaje-error mb-6 pr-14" data-sin-conexion>
      <Icono nombre="senal" /> <span><strong>Sin conexión.</strong> {quien === "socio" ? "Lo que hagas ahora puede no guardarse. Para entrar, decí tu DNI en la recepción." : "Lo que hagas ahora puede no guardarse: anotalo en papel y cargalo cuando vuelva internet."}</span>
    </p>
  );
}
