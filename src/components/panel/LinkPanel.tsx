"use client";
// Un link a otra pantalla del panel que solo aparece si esa pantalla está
// prendida para este gimnasio y este rol. Así ninguna pantalla manda a una
// apagada (un botón a la nada). Las secciones y el rol los pone el Marco.
import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { rutaDisponible, type Rol } from "@/lib/panel/secciones";

const Contexto = createContext<{ rol: Rol; apagadas: string[] } | null>(null);

export function ProveedorSecciones({ rol, apagadas, children }: { rol: Rol; apagadas: string[]; children: ReactNode }) {
  return <Contexto.Provider value={{ rol, apagadas }}>{children}</Contexto.Provider>;
}

/** true si la ruta se puede abrir; fuera del panel (sin Marco) siempre true. */
export function useRutaDisponible(href: string): boolean {
  const c = useContext(Contexto);
  return !c || rutaDisponible(href, c.rol, c.apagadas);
}

/**
 * `siNoEsta`: "nada" (por defecto, para botones: no se muestran) o "texto"
 * (para un nombre: se ve sin link).
 */
export function LinkPanel({ href, className, children, siNoEsta = "nada", textoClassName }: {
  href: string; className?: string; children: ReactNode; siNoEsta?: "nada" | "texto"; textoClassName?: string;
}) {
  if (useRutaDisponible(href)) return <Link href={href} className={className}>{children}</Link>;
  return siNoEsta === "texto" ? <span className={textoClassName}>{children}</span> : null;
}
