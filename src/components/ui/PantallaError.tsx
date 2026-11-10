"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Aviso } from "@/components/panel/Marco";
import { anotarErrorPantalla } from "@/lib/errores-acciones";
import { Icono } from "@/components/ui/Icono";

/**
 * Un error o una pantalla que no existe, siempre con salida (VD-34): Reintentar, Volver e Ir al inicio.
 * El texto de la base se muestra tal cual; el de Next en producción es genérico.
 */
export function PantallaError({ error, reset, inicio = "/", titulo, icono }: {
  error?: Error & { digest?: string }; reset?: () => void; inicio?: string; titulo?: string; icono?: string;
}) {
  const router = useRouter();
  // VD-40: el último error que vio la persona viaja con su pedido de ayuda a BRIK.
  useEffect(() => { if (error) { try { sessionStorage.setItem("gymos:ultimo-error", error.message.slice(0, 400)); } catch { /* sin almacenamiento */ } } }, [error]);
  const sinPermiso = !!error && /permiso|acceso/i.test(error.message);
  // SA-1: anotar el error para el tablero del super admin (los de permiso no son fallas).
  useEffect(() => { if (error && !sinPermiso) void anotarErrorPantalla(location.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id"), error.message); }, [error, sinPermiso]);
  return (
    <div data-pantalla-error>
    <Aviso icono={icono ?? (sinPermiso ? "candado" : "alerta")} titulo={titulo ?? (sinPermiso ? "No tenés acceso a esta pantalla" : "No se pudo cargar esta pantalla")}>
      {error && <p>{error.message}</p>}
      <div className="flex flex-wrap gap-2 mt-6">
        {reset && !sinPermiso && <button type="button" onClick={reset} className="boton boton-principal"><Icono nombre="repetir" /> Probar de nuevo</button>}
        <button type="button" onClick={() => router.back()} className="boton">← Volver</button>
        <Link href={inicio} className="boton"><Icono nombre="inicio" /> Ir al inicio</Link>
      </div>
    </Aviso>
    </div>
  );
}
