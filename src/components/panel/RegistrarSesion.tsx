"use client";
import { useEffect } from "react";
import { registrarSesionEquipo } from "@/app/panel/seguridad-acciones";

/** VD-42: una vez por pestaña, anota desde qué dispositivo entra esta persona (no muestra nada). */
export function RegistrarSesion() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("gymos_sesion_anotada")) return;
      sessionStorage.setItem("gymos_sesion_anotada", "1");
    } catch { /* sin almacenamiento: se anota igual, una vez por carga */ }
    void registrarSesionEquipo();
  }, []);
  return null;
}
