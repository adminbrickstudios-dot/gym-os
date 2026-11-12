"use client";
import { useEffect, useState } from "react";

/**
 * D49 · Lo que lleva todo formulario público (sin sesión) contra los robots, sin servicios externos:
 *  - `sitio`: un campo trampa que una persona no ve ni llena; si viene lleno, el servidor lo toma por robot.
 *  - `segundos`: cuánto hace que está abierta la página (se cuenta acá, con el reloj de este navegador: no depende de la
 *    hora del celular). El servidor no acepta un envío con menos de 3 segundos: una persona no llena un formulario en eso.
 * El servidor lo resuelve en `frenarEnvioPublico` (src/lib/seguridad/envio-publico.ts).
 */
export function CampoAntiRobot() {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSegundos((s) => Math.min(s + 1, 86400)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <input name="sitio" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <input type="hidden" name="segundos" value={segundos} readOnly />
    </>
  );
}
