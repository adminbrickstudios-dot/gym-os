"use client";
import { useEffect } from "react";
import { leerNovedades } from "./acciones";

/** Al abrir, lo nuevo pasa a visto (esta vez todavía se ve como nuevo). */
export function MarcarLeidas({ claves }: { claves: string[] }) {
  const lista = claves.join("|");
  useEffect(() => { if (lista) void leerNovedades(lista.split("|")); }, [lista]);
  return null;
}
