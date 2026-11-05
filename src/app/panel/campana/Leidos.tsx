"use client";
import { useEffect } from "react";
import { leerCampana } from "./acciones";

/** Al abrir la campana, lo nuevo pasa a visto (se ve marcado como nuevo esta vez). */
export function MarcarLeidos({ claves }: { claves: string[] }) {
  const lista = claves.join("|");
  useEffect(() => { if (lista) void leerCampana(lista.split("|")); }, [lista]);
  return null;
}
