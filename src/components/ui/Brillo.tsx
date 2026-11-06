"use client";
import { useState } from "react";

/**
 * Un número que, cuando cambia (la pantalla se refresca y llega otro valor), se ilumina 600 ms.
 * La primera vez no brilla: solo lo que cambió.
 */
export function Brillo({ valor, className = "" }: { valor: string | number; className?: string }) {
  const [anterior, setAnterior] = useState(valor);
  const [cambios, setCambios] = useState(0);
  if (anterior !== valor) { setAnterior(valor); setCambios(cambios + 1); }
  return <span key={cambios} className={`${cambios > 0 ? "brillo" : ""} ${className}`}>{valor}</span>;
}
