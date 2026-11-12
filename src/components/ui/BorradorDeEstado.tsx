"use client";
// FLUIDEZ regla 7 para formularios con el estado en React (rutina, evento): guarda lo escrito en el dispositivo (borrador.ts, 7 días,
// nunca en la base) y, al volver con el formulario sin tocar, ofrece seguir. Se pone dentro del formulario. Quien lo usa llama a
// `borrarBorradorDe(clave)` cuando el guardado sale bien.
import { useEffect, useRef, useState } from "react";
import { borrarBorrador, guardarBorrador, leerBorrador } from "@/lib/app/borrador";

const almacen = () => { try { return window.localStorage; } catch { return null; } };

export function borrarBorradorDe(clave: string) { borrarBorrador(almacen(), clave); }

export function BorradorDeEstado<T>({ clave, valor, aplicar }: { clave: string; valor: T; aplicar: (v: T) => void }) {
  const inicial = useRef(JSON.stringify(valor));
  const [pendiente, setPendiente] = useState<T | null>(null);

  useEffect(() => {
    const b = leerBorrador(almacen(), clave);
    if (!b?.campos.estado) return;
    try {
      const v = JSON.parse(b.campos.estado) as T;
      if (JSON.stringify(v) !== inicial.current) setPendiente(v);    } catch { borrarBorrador(almacen(), clave); }
  }, [clave]);

  useEffect(() => {
    if (pendiente !== null) return;   // mientras se ofrece el borrador no se lo pisa con el formulario vacío
    const ahora = JSON.stringify(valor);
    if (ahora === inicial.current) return;
    const espera = setTimeout(() => guardarBorrador(almacen(), clave, { estado: ahora }), 500);
    return () => clearTimeout(espera);
  }, [clave, valor, pendiente]);

  if (pendiente === null) return null;
  return (
    <div className="tarjeta p-4 space-y-3 sm:col-span-2" role="region" aria-label="Borrador guardado" data-borrador>
      <p className="font-semibold">¿Seguimos donde dejaste?</p>
      <p className="texto-suave text-sm">Quedó guardado lo que habías escrito en este dispositivo.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="boton boton-principal !min-h-11" data-borrador-seguir onClick={() => { aplicar(pendiente); setPendiente(null); }}>Seguir</button>
        <button type="button" className="boton !min-h-11" data-borrador-descartar onClick={() => { borrarBorrador(almacen(), clave); setPendiente(null); }}>Empezar de nuevo</button>
      </div>
    </div>
  );
}
